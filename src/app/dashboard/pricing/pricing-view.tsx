'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui'
import { aed, aedShort } from '@/lib/demo-format'
import { TIER_LABELS } from '@/lib/project-constants'
import type { RateCardEntryDTO, PricingSheetSummaryDTO } from '@/lib/services/pricing'
import {
  createRateCardEntryAction,
  updateRateCardEntryAction,
  deleteRateCardEntryAction,
} from '@/app/actions/pricing'
import { Alert, FieldError } from '@/components/ui'

interface PricingViewProps {
  rateCard: RateCardEntryDTO[]
  sheets: PricingSheetSummaryDTO[]
  canEditRates?: boolean
  canEditSheets?: boolean
}

const field = 'w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent'
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted'

function RateCardModal({
  entry,
  onClose,
}: {
  entry: RateCardEntryDTO | null
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>()
  const isEditing = Boolean(entry)

  function submit(formData: FormData) {
    setError(null)
    setFieldErrors(undefined)
    startTransition(async () => {
      const res = isEditing
        ? await updateRateCardEntryAction(null, formData)
        : await createRateCardEntryAction(null, formData)
      if (res?.error) setError(res.error)
      else if (res?.fieldErrors) setFieldErrors(res.fieldErrors)
      else onClose()
    })
  }

  function remove() {
    if (!entry) return
    if (!confirm(`Remove ${entry.name} from the rate card?`)) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('serviceId', entry.id)
      const res = await deleteRateCardEntryAction(null, fd)
      if (res?.error) setError(res.error)
      else onClose()
    })
  }

  // Show hourly in the form (day = hourly × 8); entry gives day rates.
  const hr = (day: number) => (day ? Math.round((day / 8) * 100) / 100 : '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-card border border-line-2 bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-ink">{isEditing ? 'Edit rate' : 'Add role'}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current [stroke-width:2]">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

        <form action={submit} className="space-y-4">
          {isEditing && <input type="hidden" name="serviceId" value={entry?.id} />}
          <div>
            <label className={labelCls}>Role</label>
            <input name="name" required defaultValue={entry?.name || ''} placeholder="Brand Strategist" className={field} />
            <FieldError errors={fieldErrors?.name} />
          </div>
          <div>
            <label className={labelCls}>Note</label>
            <input name="note" defaultValue={entry?.note || ''} placeholder="Where the rate comes from" className={field} />
          </div>
          <div>
            <label className={labelCls}>Hourly rate (AED) — day rate is ×8</label>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'medium', 'large'] as const).map((t) => (
                <div key={t}>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-faint">{t}</div>
                  <input
                    name={t}
                    type="number"
                    min={0}
                    step={0.25}
                    required
                    defaultValue={entry ? hr(entry.day[t]) : ''}
                    className={field}
                  />
                </div>
              ))}
            </div>
            <FieldError errors={fieldErrors?.hourly} />
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
            {isEditing ? (
              <button type="button" onClick={remove} disabled={isPending} className="text-xs font-semibold text-bad hover:underline disabled:opacity-50">
                Remove role
              </button>
            ) : <div />}
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} disabled={isPending} className="rounded-field border border-line-2 px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="rounded-field bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-press disabled:opacity-50">
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PricingView({ rateCard, sheets, canEditRates = false, canEditSheets = false }: PricingViewProps) {
  const [modal, setModal] = useState<{ open: boolean; entry: RateCardEntryDTO | null }>({ open: false, entry: null })

  return (
    <>
      <PageHeader
        title="Pricing"
        description="The rate card drives every sheet. Each project's sheet turns a phase plan into a suggested price at the client's tier."
        action={
          canEditRates ? (
            <button
              type="button"
              onClick={() => setModal({ open: true, entry: null })}
              className="flex shrink-0 items-center gap-2 rounded-field bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-press"
            >
              <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add role
            </button>
          ) : null
        }
      />

      {/* Rate card */}
      <section className="mb-10">
        <h2 className="mb-3 text-base font-bold uppercase tracking-wider text-ink">Rate card · day rates</h2>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-right">Small business</th>
                  <th className="px-4 py-3 text-right">Medium business</th>
                  <th className="px-4 py-3 text-right">Large corporate</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rateCard.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-ink">{r.name}</div>
                      {r.note && <div className="text-xs text-muted">{r.note}</div>}
                    </td>
                    {(['small', 'medium', 'large'] as const).map((t) => (
                      <td key={t} className="px-4 py-3.5 text-right font-semibold text-ink [font-variant-numeric:tabular-nums]">
                        {aed(r.day[t])}
                        <span className="ml-1 text-[11px] font-normal text-faint">/day</span>
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-right">
                      {canEditRates && (
                        <button
                          type="button"
                          onClick={() => setModal({ open: true, entry: r })}
                          className="text-muted hover:text-ink"
                          title="Edit rate"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                            <path d="M14 6l4 4" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {rateCard.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                      No rate-card roles yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing sheets */}
      <section className="mb-10">
        <h2 className="mb-3 text-base font-bold uppercase tracking-wider text-ink">Pricing sheets</h2>
        {sheets.length === 0 ? (
          <div className="rounded-card border border-line bg-surface p-10 text-center text-sm text-muted">
            No pricing sheets yet — start one from a project.
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">
                    <th className="px-4 py-3 text-left">Client · Project</th>
                    <th className="px-4 py-3 text-left">Service</th>
                    <th className="px-4 py-3 text-left">Submitted tier</th>
                    <th className="px-4 py-3 text-right">Suggested</th>
                    <th className="px-4 py-3 text-right">Sold</th>
                    <th className="px-4 py-3 text-right">Gap</th>
                    <th className="w-8 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sheets.map((s) => (
                    <tr key={s.projectId} className="group cursor-pointer hover:bg-surface-2">
                      <td className="px-4 py-3.5">
                        <Link href={`/dashboard/pricing/${s.projectId}`} className="block">
                          <div className="font-semibold text-ink group-hover:text-accent">{s.clientName}</div>
                          <div className="text-xs text-muted">{s.projectName}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex h-6 items-center rounded-[20px] border border-line bg-surface-3 px-2.5 text-[11px] font-semibold text-ink-2">
                          {s.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-body">{TIER_LABELS[s.submittedTier] ?? s.submittedTier}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-ink [font-variant-numeric:tabular-nums]">{aed(s.submittedPrice)}</td>
                      <td className="px-4 py-3.5 text-right text-body [font-variant-numeric:tabular-nums]">{s.soldPrice ? aed(s.soldPrice) : '—'}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold [font-variant-numeric:tabular-nums]">
                        {s.soldPrice ? (
                          <span className={s.gap >= 0 ? 'text-ok' : 'text-bad'}>
                            {s.gap >= 0 ? '+' : '−'}
                            {aedShort(Math.abs(s.gap))}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/dashboard/pricing/${s.projectId}`} className="text-muted group-hover:text-accent">
                          <svg viewBox="0 0 24 24" className="ml-auto h-4 w-4 fill-none stroke-current [stroke-width:2]">
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!canEditSheets && (
          <p className="mt-2 text-xs text-faint">You can view sheets; editing needs the &ldquo;Edit projects&rdquo; permission.</p>
        )}
      </section>

      {modal.open && <RateCardModal entry={modal.entry} onClose={() => setModal({ open: false, entry: null })} />}
    </>
  )
}
