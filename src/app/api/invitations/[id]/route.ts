import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import { revokeInvitation } from '@/lib/services/invitations'
import { apiError } from '../../_helpers'

/**
 * DELETE /api/invitations/:id — revoke a pending invite.
 */
export async function DELETE(_request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requirePermission('member.invite')
    const { id } = ctx.params
    await revokeInvitation(actor, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err)
  }
}
