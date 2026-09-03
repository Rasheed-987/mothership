import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import { createDeal, dealSchema, listDeals } from '@/lib/services/deals'
import { apiError, readJson } from '../_helpers'

/** GET /api/deals — every deal with client name, owner, and probability-adjusted value. */
export async function GET() {
  try {
    await requirePermission('deal.view')
    return NextResponse.json({ deals: await listDeals() })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * POST /api/deals — create an opportunity.
 *
 * Body: { title, clientId, category?, stage?, confidence?, value?, probability?,
 *         expectedCloseDate?, nextFollowUpDate?, ownerId?, source? }
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePermission('deal.create')
    const body = dealSchema.parse(await readJson(request))
    const deal = await createDeal(actor, body)
    return NextResponse.json({ deal }, { status: 201 })
  } catch (err) {
    return apiError(err)
  }
}
