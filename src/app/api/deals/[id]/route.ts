import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import {
  deleteDeal,
  getDealById,
  updateDeal,
  updateDealSchema,
  addDealNote,
  noteSchema,
} from '@/lib/services/deals'
import { apiError, readJson } from '../../_helpers'

type Ctx = { params: { id: string } }

/** GET /api/deals/:id — one opportunity, fully resolved. */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requirePermission('deal.view')
    const deal = await getDealById(ctx.params.id)
    if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 })
    return NextResponse.json({ deal })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * PATCH /api/deals/:id — update a subset of fields, or append a note.
 *
 * `{ note: { text } }` logs an activity entry; anything else is a field update.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission('deal.update')
    const raw = (await readJson(request)) as Record<string, unknown>

    if (raw && typeof raw === 'object' && 'note' in raw) {
      const body = noteSchema.parse(raw.note)
      const deal = await addDealNote(actor, ctx.params.id, body)
      return NextResponse.json({ deal })
    }

    const body = updateDealSchema.parse(raw)
    const deal = await updateDeal(actor, ctx.params.id, body)
    return NextResponse.json({ deal })
  } catch (err) {
    return apiError(err)
  }
}

/** DELETE /api/deals/:id — remove an opportunity. */
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission('deal.delete')
    await deleteDeal(actor, ctx.params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err)
  }
}
