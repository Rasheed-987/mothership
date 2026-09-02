import 'server-only'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import { audit } from '@/lib/audit'
import { ALL_PERMISSIONS, type Permission } from '@/lib/permissions'
import { Role } from '@/models/Role'
import { User } from '@/models/User'
import type { CurrentUser } from '@/lib/authz'

export const createRoleSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]*$/, { message: 'Use snake_case: letters, numbers and underscores.' })
    .max(40),
  name: z.string().trim().min(2, { message: 'Give the role a readable name.' }).max(60),
  description: z.string().trim().max(300).optional(),
  permissions: z
    .array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]]))
    .min(1, { message: 'Pick at least one permission.' }),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly field?: string,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export async function listRoles() {
  await connectDB()
  const roles = await Role.find().sort({ name: 1 }).lean()

  // Holder counts drive the "can this be deleted?" affordance in the UI.
  const counts = await User.aggregate<{ _id: unknown; count: number }>([
    { $unwind: '$roles' },
    { $group: { _id: '$roles.roleId', count: { $sum: 1 } } },
  ])
  const byRole = new Map(counts.map((c) => [String(c._id), c.count]))

  return roles.map((r) => ({
    id: String(r._id),
    key: r.key,
    name: r.name,
    description: r.description ?? '',
    isSystem: r.isSystem,
    permissions: r.permissions,
    memberCount: byRole.get(String(r._id)) ?? 0,
  }))
}

export async function createRole(actor: CurrentUser, input: CreateRoleInput) {
  await connectDB()

  // You cannot grant a permission you do not hold yourself — without this,
  // `role.create` would be a backdoor to admin for anyone who holds it.
  if (!actor.isSuperAdmin) {
    const overreach = input.permissions.filter((p) => !actor.permissions.includes(p))
    if (overreach.length) {
      throw new ServiceError(`You cannot grant permissions you don't hold: ${overreach.join(', ')}`, 403, 'permissions')
    }
  }

  const existing = await Role.findOne({ key: input.key }).lean()
  if (existing) throw new ServiceError(`A role with the key "${input.key}" already exists.`, 409, 'key')

  const role = await Role.create({
    key: input.key,
    name: input.name,
    description: input.description,
    permissions: input.permissions,
    isSystem: false,
    createdBy: actor.id,
  })

  await audit({
    actorId: actor.id,
    action: 'role.created',
    targetType: 'Role',
    targetId: String(role._id),
    metadata: { key: role.key, permissionCount: role.permissions.length },
  })

  return {
    id: String(role._id),
    key: role.key,
    name: role.name,
    permissions: role.permissions,
  }
}

export async function deleteRole(actor: CurrentUser, roleId: string) {
  await connectDB()

  const role = await Role.findById(roleId)
  if (!role) throw new ServiceError('Role not found.', 404)
  if (role.isSystem) throw new ServiceError('System roles cannot be deleted.', 400)

  // Mongo has no foreign keys, so nothing would stop this leaving dangling
  // roleIds on user documents. Refuse instead of orphaning them.
  const holders = await User.countDocuments({ 'roles.roleId': role._id })
  if (holders > 0) {
    throw new ServiceError(`${holders} member${holders === 1 ? '' : 's'} still hold this role. Reassign them first.`, 409)
  }

  await role.deleteOne()
  await audit({ actorId: actor.id, action: 'role.deleted', targetType: 'Role', targetId: roleId, metadata: { key: role.key } })
}
