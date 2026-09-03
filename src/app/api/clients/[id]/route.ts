import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import { deleteClient, getClientById, updateClient, updateClientSchema } from '@/lib/services/clients'
import { apiError, readJson } from '../../_helpers'

type Ctx = { params: { id: string } }

/** GET /api/clients/:id — one client with its projects grouped by status. */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requirePermission('client.view')
    const client = await getClientById(ctx.params.id)
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    return NextResponse.json({ client })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * PATCH /api/clients/:id — update any subset of client fields.
 *
 * Body: partial of the POST body. Omitted fields are left untouched.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission('client.update')
    const body = updateClientSchema.parse(await readJson(request))
    const client = await updateClient(actor, ctx.params.id, body)
    return NextResponse.json({ client })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * DELETE /api/clients/:id — remove a client.
 *
 * Refused with 409 while the client still has projects.
 */
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission('client.delete')
    await deleteClient(actor, ctx.params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err)
  }
}
