import type { Permission } from './permissions'

/**
 * Pure authorization logic — no database, no cookies, no Next imports.
 *
 * Kept separate from dal.ts so services and tests can reason about permissions
 * without dragging in `next/navigation` and a request context.
 */

export type CurrentUser = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  isSuperAdmin: boolean
  roles: { id: string; key: string; name: string }[]
  /** Union of every held role's permissions. Super admins get the full catalog. */
  permissions: Permission[]
}

export class AuthorizationError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`)
    this.name = 'AuthorizationError'
  }
}

export function userCan(user: CurrentUser | null, permission: Permission): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.permissions.includes(permission)
}

/** Resolves a set of roles into the union of permissions they confer. */
export function resolveGrants(roles: { permissions: Permission[] }[]): Permission[] {
  return [...new Set(roles.flatMap((r) => r.permissions))]
}
