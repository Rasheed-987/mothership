import { requirePermission, userCan } from '@/lib/dal'
import { listRoles } from '@/lib/services/roles'
import { listInvitations } from '@/lib/services/invitations'
import { revokeInviteAction } from '@/app/actions/admin'
import { connectDB } from '@/lib/db'
import { User } from '@/models/User'
import { Role } from '@/models/Role'
import { Badge, Card, PageHeader } from '@/components/ui'
import { InviteForm } from './invite-form'

const STATUS_TONE = {
  pending: 'amber',
  accepted: 'green',
  revoked: 'neutral',
  expired: 'neutral',
} as const

export default async function TeamPage() {
  const actor = await requirePermission('member.view')
  const canInvite = userCan(actor, 'member.invite')

  await connectDB()
  const [members, roles, invitations] = await Promise.all([
    User.find().sort({ createdAt: 1 }).lean(),
    listRoles(),
    canInvite ? listInvitations() : Promise.resolve([]),
  ])

  const roleDocs = await Role.find().lean()
  const roleName = new Map(roleDocs.map((r) => [String(r._id), r.name]))

  return (
    <>
      <PageHeader
        title="Team"
        description="Invite people by role. The link carries a one-time token; only its hash is stored."
      />

      {canInvite && (
        <InviteForm
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        />
      )}

      <h2 className="mb-3 text-lg font-semibold tracking-tight">
        Members <span className="text-sm font-normal text-black/45 dark:text-white/45">{members.length}</span>
      </h2>
      <div className="mb-10 space-y-2">
        {members.map((member) => (
          <Card key={String(member._id)} className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {member.name}
                  {String(member._id) === actor.id && (
                    <span className="ml-2 text-xs font-normal text-black/45 dark:text-white/45">you</span>
                  )}
                </p>
                <p className="truncate text-sm text-black/50 dark:text-white/50">{member.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {member.isSuperAdmin ? (
                  <Badge tone="red">super admin</Badge>
                ) : member.roles.length ? (
                  member.roles.map((r) => <Badge key={String(r.roleId)}>{roleName.get(String(r.roleId)) ?? 'unknown'}</Badge>)
                ) : (
                  <Badge>no role</Badge>
                )}
                {member.status !== 'active' && <Badge tone="amber">{member.status}</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {canInvite && (
        <>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Invitations <span className="text-sm font-normal text-black/45 dark:text-white/45">{invitations.length}</span>
          </h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">No invitations yet.</p>
          ) : (
            <div className="space-y-2">
              {invitations.map((invite) => (
                <Card key={invite.id} className="!p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invite.email}</p>
                      <p className="text-sm text-black/50 dark:text-white/50">
                        {invite.roleName} ·{' '}
                        {invite.status === 'pending'
                          ? `expires ${invite.expiresAt.toLocaleDateString()}`
                          : `created ${invite.createdAt.toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={STATUS_TONE[invite.status]}>{invite.status}</Badge>
                      {invite.status === 'pending' && (
                        <form action={revokeInviteAction}>
                          <input type="hidden" name="invitationId" value={invite.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 underline underline-offset-4 hover:opacity-80 dark:text-red-400"
                          >
                            Revoke
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
