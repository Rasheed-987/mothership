import { requireAuth } from '@/lib/dal'
import { PERMISSIONS, PERMISSION_GROUPS } from '@/lib/permissions'
import { Badge, Card, PageHeader } from '@/components/ui'

export default async function OverviewPage() {
  const user = await requireAuth()
  const held = new Set(user.permissions)

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(' ')[0]}`}
        description="This is the chain resolved for you right now: cookie → session → user → roles → permissions."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-wide text-black/45 dark:text-white/45">Signed in as</p>
          <p className="mt-1 truncate font-medium">{user.email}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-black/45 dark:text-white/45">Roles held</p>
          <p className="mt-1 font-medium">
            {user.isSuperAdmin ? 'Super admin' : user.roles.map((r) => r.name).join(', ') || 'None'}
          </p>
        </Card>
      </div>

      <h2 className="mb-1 text-lg font-semibold tracking-tight">
        Your permissions{' '}
        <span className="text-sm font-normal text-black/45 dark:text-white/45">
          {held.size} of {Object.keys(PERMISSIONS).length}
        </span>
      </h2>
      <p className="mb-5 max-w-2xl text-sm text-black/55 dark:text-white/55">
        The full catalog lives in code. Highlighted entries are the ones your roles grant — that union is what{' '}
        <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">requirePermission()</code> checks.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <Card key={group.key}>
            <h3 className="mb-3 text-sm font-semibold">{group.label}</h3>
            <ul className="space-y-1.5">
              {group.permissions.map((permission) => (
                <li key={permission} className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      held.has(permission)
                        ? 'font-mono text-black dark:text-white'
                        : 'font-mono text-black/30 line-through dark:text-white/25'
                    }
                  >
                    {permission}
                  </span>
                  {held.has(permission) && <Badge tone="green">granted</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}
