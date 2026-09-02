import { requirePermission, userCan } from '@/lib/dal'
import { listRoles } from '@/lib/services/roles'
import { deleteRoleAction } from '@/app/actions/admin'
import { Badge, Card, PageHeader } from '@/components/ui'
import { CreateRoleForm } from './create-role-form'

export default async function RolesPage() {
  const user = await requirePermission('role.view')
  const roles = await listRoles()

  const canCreate = userCan(user, 'role.create')
  const canDelete = userCan(user, 'role.delete')

  return (
    <>
      <PageHeader
        title="Roles"
        description="A role is a named bundle of permissions, stored in db.roles. Create as many as you need — no deploy required."
        action={canCreate ? <CreateRoleForm grantable={user.permissions} /> : undefined}
      />

      <div className="space-y-3">
        {roles.map((role) => {
          // A role that nobody holds and that isn't seeded.
          const removable = canDelete && !role.isSystem && role.memberCount === 0

          return (
            <Card key={role.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{role.name}</h2>
                    <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">{role.key}</code>
                    {role.isSystem && <Badge>system</Badge>}
                  </div>
                  {role.description && (
                    <p className="mt-1 text-sm text-black/55 dark:text-white/55">{role.description}</p>
                  )}
                  <p className="mt-2 text-xs text-black/45 dark:text-white/45">
                    {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'} ·{' '}
                    {role.memberCount} member{role.memberCount === 1 ? '' : 's'}
                  </p>
                </div>

                {removable && (
                  <form action={deleteRoleAction}>
                    <input type="hidden" name="roleId" value={role.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 underline underline-offset-4 hover:opacity-80 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
                  Show permissions
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {role.permissions.map((permission) => (
                    <code
                      key={permission}
                      className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px] dark:bg-white/10"
                    >
                      {permission}
                    </code>
                  ))}
                </div>
              </details>
            </Card>
          )
        })}
      </div>
    </>
  )
}
