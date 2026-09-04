import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import { listRateCard, listPricingSheets, createRateCardEntry, rateCardEntrySchema } from '@/lib/services/pricing'
import { apiError, readJson } from '../_helpers'

/** GET /api/pricing — the rate card and every project's pricing-sheet summary. */
export async function GET() {
  try {
    await requirePermission('service.view')
    const [rateCard, sheets] = await Promise.all([listRateCard(), listPricingSheets()])
    return NextResponse.json({ rateCard, sheets })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * POST /api/pricing — add a rate-card entry (a role and its per-tier hourly rate).
 *
 * Body: { name, note?, category?, hourly: { small, medium, large } }
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePermission('service.create')
    const body = rateCardEntrySchema.parse(await readJson(request))
    const entry = await createRateCardEntry(actor, body)
    return NextResponse.json({ entry }, { status: 201 })
  } catch (err) {
    return apiError(err)
  }
}
