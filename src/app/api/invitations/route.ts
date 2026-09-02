import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import { createInvitation, inviteSchema, listInvitations } from '@/lib/services/invitations'
import { apiError, readJson } from '../_helpers'

/** GET /api/invitations — the 50 most recent, with lapsed ones marked expired. */
export async function GET() {
  try {
    await requirePermission('member.view')
    return NextResponse.json({ invitations: await listInvitations() })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * POST /api/invitations — issue an invite link for a role.
 *
 * Body: { email, roleId }
 *
 * The `link` in the response contains the only copy of the raw token; the
 * database holds just its sha256. Lose it and the invite must be reissued.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePermission('member.invite')
    const body = inviteSchema.parse(await readJson(request))
    const invitation = await createInvitation(actor, body)
    return NextResponse.json({ invitation }, { status: 201 })
  } catch (err) {
    return apiError(err)
  }
}
