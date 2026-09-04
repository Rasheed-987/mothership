import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import { CLIENT_TIERS, type ClientTier } from '@/models/shared'
import {
  getPricingSheet,
  updatePricingSheet,
  setSheetTier,
  setSubmittedTier,
  pricingSheetSchema,
} from '@/lib/services/pricing'
import { apiError, readJson } from '../../_helpers'

type Ctx = { params: { id: string } }

/** GET /api/pricing/:projectId — one project's fully computed pricing sheet. */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requirePermission('service.view')
    const sheet = await getPricingSheet(ctx.params.id)
    if (!sheet) return NextResponse.json({ error: 'No pricing sheet.' }, { status: 404 })
    return NextResponse.json({ sheet })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * PATCH /api/pricing/:projectId — update the sheet.
 *
 * `{ tier }` alone switches the explored tier; `{ submittedTier }` sets what was
 * quoted; anything else replaces the sheet body.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission('project.update')
    const raw = (await readJson(request)) as Record<string, unknown>

    const isTier = (v: unknown): v is ClientTier => (CLIENT_TIERS as readonly string[]).includes(String(v))

    if (raw && typeof raw === 'object' && Object.keys(raw).length === 1 && isTier(raw.tier)) {
      await setSheetTier(actor, ctx.params.id, raw.tier)
      return NextResponse.json({ sheet: await getPricingSheet(ctx.params.id) })
    }
    if (raw && typeof raw === 'object' && 'submittedTier' in raw && isTier(raw.submittedTier)) {
      await setSubmittedTier(actor, ctx.params.id, raw.submittedTier)
      return NextResponse.json({ sheet: await getPricingSheet(ctx.params.id) })
    }

    const body = pricingSheetSchema.parse(raw)
    await updatePricingSheet(actor, ctx.params.id, body)
    return NextResponse.json({ sheet: await getPricingSheet(ctx.params.id) })
  } catch (err) {
    return apiError(err)
  }
}
