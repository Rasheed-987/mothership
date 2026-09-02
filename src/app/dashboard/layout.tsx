import { requireAuth, userCan } from '@/lib/dal'
import { logout } from '@/app/actions/auth'
import type { Permission } from '@/lib/permissions'
import Sidebar, { type NavItem } from '@/components/sidebar'

const NAV: (NavItem & { permission?: Permission })[] = [
  { href: '/dashboard', label: 'Overview', icon: 'home', section: 'Workspace' },
  { href: '/dashboard/team', label: 'Team', icon: 'users', section: 'Workspace', permission: 'member.view' },
  { href: '/dashboard/roles', label: 'Roles', icon: 'shield', section: 'Workspace', permission: 'role.view' },
  // Sections from the design reference — pages land in later phases.
  { href: '/dashboard/clients', label: 'Clients', icon: 'briefcase', section: 'Operations' },
  { href: '/dashboard/projects', label: 'Projects', icon: 'folder', section: 'Operations' },
  { href: '/dashboard/financials', label: 'Financials', icon: 'dollar', section: 'Operations', disabled: true },
  { href: '/dashboard/pricing', label: 'Pricing', icon: 'tag', section: 'Operations', disabled: true },
  { href: '/dashboard/archive', label: 'Archive', icon: 'archive', section: 'Operations', disabled: true },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The real gate. proxy.ts only checked that a cookie existed; this verifies
  // the session against the database and redirects if it doesn't hold up.
  const user = await requireAuth()

  const visible = NAV.filter((item) => !item.permission || userCan(user, item.permission)).map(
    ({ href, label, icon, section, disabled }) => ({ href, label, icon, section, disabled }),
  )

  const role = user.isSuperAdmin
    ? 'Owner'
    : user.roles.map((r) => r.name).join(', ') || 'Member'

  return (
    <div className="grid w-full flex-1 grid-cols-[var(--rail-w)_1fr] max-[860px]:grid-cols-[1fr]">
      <Sidebar items={visible} user={{ name: user.name, role }} logoutAction={logout} />
      <main className="min-w-0">
        <div className="mx-auto w-full max-w-5xl px-6 py-10">{children}</div>
      </main>
    </div>
  )
}
