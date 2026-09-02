import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import { createRole, createRoleSchema, listRoles } from '@/lib/services/roles'
import { apiError, readJson } from '../_helpers'

/** GET /api/roles — every role with its permissions and holder count. */
export async function GET() {
  try {
    await requirePermission('role.view')
    return NextResponse.json({ roles: await listRoles() })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * POST /api/roles — create a custom role.
 *
 * Body: { key, name, description?, permissions[] }
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePermission('role.create')
    const body = createRoleSchema.parse(await readJson(request))
    const role = await createRole(actor, body)
    return NextResponse.json({ role }, { status: 201 })
  } catch (err) {
    return apiError(err)
  }
}
