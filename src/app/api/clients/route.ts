import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import { createClient, clientSchema, listClients } from '@/lib/services/clients'
import { apiError, readJson } from '../_helpers'

/** GET /api/clients — every client with project counts and total value. */
export async function GET() {
  try {
    await requirePermission('client.view')
    return NextResponse.json({ clients: await listClients() })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * POST /api/clients — add a client.
 *
 * Body: { name, industry?, country?, contactName?, contactEmail?, contactPhone?, docs?, logoUrl?, status? }
 *
 * Names are unique (case-insensitive); a duplicate returns 409 with `field: 'name'`.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePermission('client.create')
    const body = clientSchema.parse(await readJson(request))
    const client = await createClient(actor, body)
    return NextResponse.json({ client }, { status: 201 })
  } catch (err) {
    return apiError(err)
  }
}
