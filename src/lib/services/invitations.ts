import 'server-only'
import { z } from 'zod'
import mongoose from 'mongoose'
import { connectDB, withTransaction } from '@/lib/db'
import { env } from '@/lib/env'
import { audit } from '@/lib/audit'
import type { CurrentUser } from '@/lib/authz'
import { hashPassword } from '@/lib/auth/password'
import { generateToken, hashToken, packInviteToken, tokensMatch, unpackInviteToken } from '@/lib/auth/tokens'
import { Invitation } from '@/models/Invitation'
import { Role } from '@/models/Role'
import { User } from '@/models/User'
import { ServiceError } from './roles'

export const INVITE_TTL_DAYS = 7

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Enter a valid email address.' }),
  roleId: z.string().refine(mongoose.isValidObjectId, { message: 'Pick a role.' }),
})

export const acceptSchema = z
  .object({
    token: z.string().min(10),
    name: z.string().trim().min(2, { message: 'Enter your name.' }).max(120),
    password: z
      .string()
      .min(10, { message: 'Use at least 10 characters.' })
      .regex(/[a-zA-Z]/, { message: 'Include a letter.' })
      .regex(/[0-9]/, { message: 'Include a number.' }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export type InviteInput = z.infer<typeof inviteSchema>

/**
 * Creates the invitation and returns the one-time link.
 *
 * The raw token is returned here and never again — only its sha256 is stored,
 * so if the invite is lost it must be reissued rather than recovered.
 */
export async function createInvitation(actor: CurrentUser, input: InviteInput) {
  await connectDB()

  const role = await Role.findById(input.roleId).lean()
  if (!role) throw new ServiceError('That role no longer exists.', 404, 'roleId')

  const existingUser = await User.findOne({ email: input.email }).lean()
  if (existingUser) {
    throw new ServiceError('Someone with that email already has an account.', 409, 'email')
  }

  // Supersede any live invite rather than tripping the unique partial index.
  await Invitation.updateMany({ email: input.email, status: 'pending' }, { $set: { status: 'revoked' } })

  const rawToken = generateToken()
  const invitation = await Invitation.create({
    email: input.email,
    roleId: role._id,
    tokenHash: hashToken(rawToken),
    invitedBy: actor.id,
    status: 'pending',
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  })

  await audit({
    actorId: actor.id,
    action: 'invitation.created',
    targetType: 'Invitation',
    targetId: String(invitation._id),
    metadata: { email: input.email, role: role.key },
  })

  return {
    id: String(invitation._id),
    email: invitation.email,
    role: { id: String(role._id), key: role.key, name: role.name },
    expiresAt: invitation.expiresAt,
    // No email provider is wired up yet — the super admin copies this link.
    link: `${env.APP_URL}/invite/${packInviteToken(String(invitation._id), rawToken)}`,
  }
}

/** Read-only lookup for rendering the accept page before anything is committed. */
export async function inspectInvitation(packed: string) {
  await connectDB()

  const parts = unpackInviteToken(packed)
  if (!parts || !mongoose.isValidObjectId(parts.id)) return { ok: false as const, reason: 'invalid' as const }

  const invitation = await Invitation.findById(parts.id).lean()
  if (!invitation) return { ok: false as const, reason: 'invalid' as const }

  // Constant-time compare so the endpoint can't be used to guess tokens byte by byte.
  if (!tokensMatch(hashToken(parts.token), invitation.tokenHash)) {
    return { ok: false as const, reason: 'invalid' as const }
  }
  if (invitation.status === 'accepted') return { ok: false as const, reason: 'accepted' as const }
  if (invitation.status === 'revoked') return { ok: false as const, reason: 'revoked' as const }
  if (invitation.expiresAt.getTime() <= Date.now()) return { ok: false as const, reason: 'expired' as const }

  const role = await Role.findById(invitation.roleId).lean()

  return {
    ok: true as const,
    email: invitation.email,
    roleName: role?.name ?? 'Member',
    expiresAt: invitation.expiresAt,
  }
}

/**
 * Redeems the invite: creates the account, attaches the role, and burns the
 * invitation — all in one transaction, so a crash halfway cannot leave a user
 * with no role or an invite consumed with no user behind it.
 *
 * Returns the new user's id; the caller creates the session, because cookies
 * can only be written from a Server Action or Route Handler.
 */
export async function acceptInvitation(input: { token: string; name: string; password: string }) {
  await connectDB()

  const parts = unpackInviteToken(input.token)
  if (!parts || !mongoose.isValidObjectId(parts.id)) throw new ServiceError('This invitation link is not valid.', 400)

  const invitation = await Invitation.findById(parts.id)
  if (!invitation) throw new ServiceError('This invitation link is not valid.', 400)
  if (!tokensMatch(hashToken(parts.token), invitation.tokenHash)) {
    throw new ServiceError('This invitation link is not valid.', 400)
  }
  if (invitation.status !== 'pending') throw new ServiceError('This invitation has already been used or revoked.', 409)
  if (invitation.expiresAt.getTime() <= Date.now()) {
    invitation.status = 'expired'
    await invitation.save()
    throw new ServiceError('This invitation has expired. Ask for a new one.', 410)
  }

  const alreadyRegistered = await User.findOne({ email: invitation.email }).lean()
  if (alreadyRegistered) throw new ServiceError('An account with this email already exists. Log in instead.', 409)

  const passwordHash = await hashPassword(input.password)

  const userId = await withTransaction(async (session) => {
    const [user] = await User.create(
      [
        {
          email: invitation.email,
          name: input.name,
          passwordHash,
          status: 'active',
          // Redeeming a link sent to this address proves control of it.
          emailVerifiedAt: new Date(),
          isSuperAdmin: false,
          roles: [{ roleId: invitation.roleId, assignedBy: invitation.invitedBy, assignedAt: new Date() }],
        },
      ],
      { session, ordered: true },
    )

    await Invitation.updateOne(
      { _id: invitation._id, status: 'pending' },
      { $set: { status: 'accepted', acceptedAt: new Date(), acceptedBy: user._id } },
      { session },
    )

    return user._id
  })

  await audit({
    actorId: userId,
    action: 'invitation.accepted',
    targetType: 'Invitation',
    targetId: String(invitation._id),
    metadata: { email: invitation.email },
  })

  return String(userId)
}

export async function listInvitations() {
  await connectDB()

  // Lazily mark lapsed invites so the list reflects reality without a cron job.
  await Invitation.updateMany(
    { status: 'pending', expiresAt: { $lte: new Date() } },
    { $set: { status: 'expired' } },
  )

  const invites = await Invitation.find().sort({ createdAt: -1 }).limit(50).lean()
  const roles = await Role.find({ _id: { $in: invites.map((i) => i.roleId) } }).lean()
  const roleById = new Map(roles.map((r) => [String(r._id), r]))

  return invites.map((i) => ({
    id: String(i._id),
    email: i.email,
    roleName: roleById.get(String(i.roleId))?.name ?? 'Unknown role',
    status: i.status,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }))
}

export async function revokeInvitation(actor: CurrentUser, id: string) {
  await connectDB()
  if (!mongoose.isValidObjectId(id)) throw new ServiceError('Invitation not found.', 404)

  const result = await Invitation.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'revoked' } })
  if (result.matchedCount === 0) throw new ServiceError('That invitation is no longer pending.', 409)

  await audit({ actorId: actor.id, action: 'invitation.revoked', targetType: 'Invitation', targetId: id })
}
