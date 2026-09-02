/**
 * End-to-end check of the invitation lifecycle, against the real database.
 *
 * Run with:  npm run e2e
 *
 * Needs `--conditions=react-server` so the `server-only` marker resolves to its
 * empty stub instead of throwing (see package.json).
 */
import mongoose from 'mongoose'
import { createInvitation, inspectInvitation, acceptInvitation } from '../src/lib/services/invitations'
import { createRole, ServiceError } from '../src/lib/services/roles'
import { verifyPassword } from '../src/lib/auth/password'
import { unpackInviteToken } from '../src/lib/auth/tokens'
import type { CurrentUser } from '../src/lib/authz'
import { Role } from '../src/models/Role'
import { User } from '../src/models/User'
import { Invitation } from '../src/models/Invitation'
import { ALL_PERMISSIONS } from '../src/lib/permissions'
import '../src/models'

const TAG = '__e2e__'
const TEST_EMAIL = `${TAG}newhire@test.local`
const TEST_PASSWORD = 'CorrectHorse42'
// Role keys must start with a letter, so this prefix differs from TAG.
const ROLE_KEY = 'e2e_junior_designer'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ` ${detail}`}`)
  ok ? passed++ : failed++
}

async function cleanup() {
  await Promise.all([
    User.deleteMany({ email: new RegExp(`^${TAG}`) }),
    Invitation.deleteMany({ email: new RegExp(`^${TAG}`) }),
    Role.deleteMany({ key: /^e2e_/ }),
  ])
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10_000 })
  await cleanup()

  const owner = await User.findOne({ isSuperAdmin: true }).lean()
  if (!owner) throw new Error('No super admin found. Run `npm run seed` first.')

  const superAdmin: CurrentUser = {
    id: String(owner._id),
    email: owner.email,
    name: owner.name,
    avatarUrl: null,
    isSuperAdmin: true,
    roles: [],
    permissions: ALL_PERMISSIONS,
  }

  // ── 1. Super admin creates a custom role at runtime ────────────────────────
  console.log('\n1. Super admin creates a role')
  const custom = await createRole(superAdmin, {
    key: ROLE_KEY,
    name: 'Junior Designer (e2e)',
    permissions: ['project.view', 'client.view', 'expense.create'],
  })
  check('role created with no deploy', custom.permissions.length === 3)

  const fromDb = await Role.findById(custom.id).lean()
  check('it is a real document in db.roles', fromDb?.key === ROLE_KEY)
  check('marked isSystem: false, so it stays deletable', fromDb?.isSystem === false)

  // ── 2. Invitation ─────────────────────────────────────────────────────────
  console.log('\n2. Super admin invites someone into that role')
  const invite = await createInvitation(superAdmin, { email: TEST_EMAIL, roleId: custom.id })
  check('invite link generated', invite.link.includes('/invite/'))

  const stored = await Invitation.findById(invite.id).lean()
  const rawToken = unpackInviteToken(invite.link.split('/invite/')[1]!)!.token
  check('raw token is NOT stored in the database', stored!.tokenHash !== rawToken)
  check('only its sha256 is stored', /^[0-9a-f]{64}$/.test(stored!.tokenHash))
  check('status starts pending', stored!.status === 'pending')

  // ── 3. The invitee opens the link ─────────────────────────────────────────
  console.log('\n3. Invitee opens the link')
  const packed = invite.link.split('/invite/')[1]!
  const preview = await inspectInvitation(packed)
  check('link resolves to the right email and role', preview.ok && preview.email === TEST_EMAIL)

  const tampered = await inspectInvitation(packed.slice(0, -3) + 'aaa')
  check('a tampered token is rejected', !tampered.ok)

  // ── 4. They set credentials ───────────────────────────────────────────────
  console.log('\n4. Invitee sets their password')
  const userId = await acceptInvitation({ token: packed, name: 'New Hire', password: TEST_PASSWORD })
  const created = await User.findById(userId).select('+passwordHash').lean()

  check('account created', created?.email === TEST_EMAIL)
  check('the invited role is attached', String(created!.roles[0]!.roleId) === custom.id)
  check('email marked verified (they proved control of it)', created!.emailVerifiedAt !== null)
  check('password stored as an argon2id hash', created!.passwordHash.startsWith('$argon2id$'))
  check('plaintext password is nowhere in the document', !JSON.stringify(created).includes(TEST_PASSWORD))

  // ── 5. Those credentials work for login ───────────────────────────────────
  console.log('\n5. Those credentials work next time they log in')
  check('correct password verifies', await verifyPassword(created!.passwordHash, TEST_PASSWORD))
  check('wrong password does not', !(await verifyPassword(created!.passwordHash, 'WrongPassword1')))

  const resolvedRoles = await Role.find({ _id: { $in: created!.roles.map((r) => r.roleId) } }).lean()
  const effective = [...new Set(resolvedRoles.flatMap((r) => r.permissions))]
  check('their permissions resolve from the role', effective.includes('project.view') && effective.includes('expense.create'))
  check('and nothing more', !effective.includes('invoice.send'))

  // ── 6. The link is burned ─────────────────────────────────────────────────
  console.log('\n6. The invite is single-use')
  const after = await Invitation.findById(invite.id).lean()
  check('invitation marked accepted', after!.status === 'accepted')
  check('acceptedBy recorded', String(after!.acceptedBy) === userId)

  let reuseBlocked = false
  try {
    await acceptInvitation({ token: packed, name: 'Impostor', password: 'AnotherPass99' })
  } catch (err) {
    reuseBlocked = err instanceof ServiceError
  }
  check('the same link cannot be redeemed twice', reuseBlocked)

  await cleanup()
  await mongoose.disconnect()
  console.log(`\n${failed === 0 ? '✓' : '✗'} ${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error('\n✗ e2e crashed:', err)
  await cleanup().catch(() => {})
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
