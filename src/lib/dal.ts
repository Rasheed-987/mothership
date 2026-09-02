import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/db'
import { readSession } from '@/lib/auth/session'
import { ALL_PERMISSIONS, type Permission } from '@/lib/permissions'
import { AuthorizationError, resolveGrants, userCan, type CurrentUser } from '@/lib/authz'
import { Role } from '@/models/Role'
import { User } from '@/models/User'

// Re-exported so callers have one import for authorization concerns.
export { AuthorizationError, userCan } from '@/lib/authz'
export type { CurrentUser } from '@/lib/authz'

/**
 * Resolved once per request via React's cache(), so a page that checks six
 * permissions still costs two queries rather than twelve.
 *
 * Deliberately not denormalized onto the user document: the moment a role's
 * permissions are edited, a cached copy on every holder would need fanning out,
 * and any missed path leaves someone holding revoked access.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession()
  if (!session) return null

  await connectDB()

  const user = await User.findById(session.userId).lean()
  if (!user) return null
  // A suspended account keeps its session row but loses all access.
  if (user.status !== 'active') return null

  const base = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
  }

  if (user.isSuperAdmin) {
    return { ...base, isSuperAdmin: true, roles: [], permissions: ALL_PERMISSIONS }
  }

  const roleIds = user.roles.map((r) => r.roleId)
  const roles = roleIds.length ? await Role.find({ _id: { $in: roleIds } }).lean() : []
  return {
    ...base,
    isSuperAdmin: false,
    roles: roles.map((r) => ({ id: String(r._id), key: r.key, name: r.name })),
    permissions: resolveGrants(roles),
  }
})

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/** Non-throwing check — use this to show or hide UI. */
export async function can(permission: Permission): Promise<boolean> {
  return userCan(await getCurrentUser(), permission)
}

/**
 * The real gate. Every Server Action and Route Handler that mutates data calls
 * this — hiding a button in the UI is cosmetic, not a security boundary.
 */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireAuth()
  if (!userCan(user, permission)) throw new AuthorizationError(permission)
  return user
}
