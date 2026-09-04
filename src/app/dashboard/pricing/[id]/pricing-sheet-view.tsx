'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { aed } from '@/lib/demo-format'
import { TIER_LABELS } from '@/lib/project-constants'
import type { PricingSheetDTO } from '@/lib/services/pricing'
import {
  createPricingSheetAction,
  setSheetTierAction,
  setSubmittedTierAction,
} from '@/app/actions/pricing'
import { Alert } from '@/components/ui'
import PricingSheetModal from '@/components/pricing-sheet-modal'

const TIERS = ['small', 'medium', 'large'] as const

interface PricingSheetViewProps {
  sheet: PricingSheetDTO | null
  project: { id: string; name: string; clientName: string }
  canEdit?: boolean
  services?: { id: string; name: string }[]
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

function Tile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: accent }} />
        <span className="text-[10.5px] font-bold uppercase tracking-[.07em] text-faint">{label}</span>
      </div>
      <div className="mt-1.5 text-lg font-bold text-ink [font-variant-numeric:tabular-nums]">{aed(value)}</div>
    </div>
  )
}

export default function PricingSheetView({ sheet, project, canEdit = false, services = [] }: PricingSheetViewProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function runTier(action: typeof setSheetTierAction, tier: string) {
    const fd = new FormData()
    fd.set('projectId', project.id)
    fd.set('tier', tier)
    setError(null)
    startTransition(async () => {
      const res = await action(null, fd)
      if (res?.error) setError(res.error)
      else router.refresh()
    })
  }

  function startSheet() {
    const fd = new FormData()
    fd.set('projectId', project.id)
    setError(null)
    startTransition(async () => {
      const res = await createPricingSheetAction(null, fd)
      if (res?.error) setError(res.error)
      else router.refresh()
    })
  }

  const back = (
    <div className="mb-6">
      <Link href="/dashboard/pricing" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
          <path d="M15 19l-7-7 7-7" />
        </svg>
        All pricing sheets
      </Link>
    </div>
  )

  if (!sheet) {
    return (
      <>
        {back}
        {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
        <div className="rounded-card border border-line bg-surface p-12 text-center">
          <h1 className="font-display text-2xl font-semibold uppercase text-ink">No pricing sheet</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {project.clientName} · {project.name} doesn&rsquo;t have a pricing sheet yet.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={startSheet}
              disabled={isPending}
              className="mt-5 rounded-field bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-press disabled:opacity-50"
            >
              {isPending ? 'Starting…' : 'Start a pricing sheet'}
            </button>
          )}
        </div>
      </>
    )
  }

  const c = sheet.computation
  const submittedC = sheet.submittedComputation
  const gap = sheet.soldPrice ? Math.round(sheet.soldPrice - submittedC.total) : null

  const cmp: ReactNode = sheet.soldPrice ? (
    <>
      The sheet suggests <b className="text-ink">{aed(submittedC.total)}</b> · you sold it for{' '}
      <b className="text-ink">{aed(sheet.soldPrice)}</b>
      {gap != null && Math.abs(gap) > 1 && (
        <>
          {' · '}
          <span className={gap >= 0 ? 'font-semibold text-ok' : 'font-semibold text-bad'}>
            {aed(Math.abs(gap))} {gap >= 0 ? 'above' : 'below'} the suggestion
          </span>
        </>
      )}{' '}
      <span className="text-faint">(final price is always yours to set on the project)</span>
    </>
  ) : (
    <>The sheet suggests <b className="text-ink">{aed(submittedC.total)}</b> at {TIER_LABELS[sheet.submittedTier]}. No sold price on the project yet.</>
  )

  return (
    <>
      {back}
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <h1 className="font-display text-3xl font-semibold uppercase leading-tight tracking-tight text-ink">
          {sheet.clientName} <span className="text-faint">·</span> {sheet.projectName}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/dashboard/projects/${sheet.projectId}`} className="flex items-center gap-1.5 rounded-field border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current [stroke-width:2]">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Open project
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-field bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current [stroke-width:2]">
                <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                <path d="M14 6l4 4" />
              </svg>
              Edit sheet
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="mb-6 rounded-card border border-line bg-surface p-6">
        <div className="text-[10.5px] font-bold uppercase tracking-[.08em] text-faint">Suggested price</div>
        <div className="font-display text-5xl font-semibold text-ink [font-variant-numeric:tabular-nums]">{aed(c.total)}</div>

        <div className="mt-4">
          {sheet.isSubmitted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(30,158,106,.13)] px-3 py-1 text-xs font-semibold text-ok">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current [stroke-width:2]">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              Submitted to client · {TIER_LABELS[sheet.submittedTier]}
            </span>
          ) : (
            <div className="rounded-field border border-line bg-surface-2 p-3 text-sm text-body">
              Exploring <b className="text-ink">{TIER_LABELS[sheet.tier]}</b>. What was submitted is{' '}
              <b className="text-ink">{TIER_LABELS[sheet.submittedTier]}</b> at {aed(submittedC.total)}.
              {canEdit && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => runTier(setSheetTierAction, sheet.submittedTier)}
                    disabled={isPending}
                    className="rounded-field border border-line-2 px-2.5 py-1 text-xs font-semibold text-muted hover:bg-surface-3"
                  >
                    Back to submitted
                  </button>
                  <button
                    type="button"
                    onClick={() => runTier(setSubmittedTierAction, sheet.tier)}
                    disabled={isPending}
                    className="rounded-field bg-ink px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Set {TIER_LABELS[sheet.tier]} as submitted
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[.07em] text-faint">Client size</div>
          <div className="flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <button
                key={t}
                type="button"
                disabled={!canEdit || isPending}
                onClick={() => runTier(setSheetTierAction, t)}
                className={`relative rounded-field border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-default ${
                  sheet.tier === t ? 'border-ink bg-ink text-white' : 'border-line-2 bg-surface text-ink hover:bg-surface-2'
                }`}
              >
                {TIER_LABELS[t]}
                <span className="ml-1.5 text-xs font-normal opacity-70">{aed(sheet.tierTotals[t])}</span>
                {sheet.submittedTier === t && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" title="Submitted to client" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Component tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Internal resourcing" value={c.internal} accent="#2C6BFF" />
        <Tile label="Vendor / 3rd-party" value={c.vendor} accent="#6B4FE6" />
        <Tile label={`Travel & expenses · ${pct(c.tePct)}`} value={c.te} accent="#D9831F" />
        <Tile label={`Admin fee · ${pct(c.adminPct)}`} value={c.admin} accent="#9AA1B2" />
      </div>

      <div className="mb-8 rounded-card border border-line bg-surface px-4 py-3 text-sm text-body">{cmp}</div>

      {/* Internal resourcing */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-bold uppercase tracking-wider text-ink">Internal resourcing</h2>
          <span className="text-sm font-semibold text-muted [font-variant-numeric:tabular-nums]">{aed(c.internal)}</span>
        </div>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 text-left">Phase</th>
                  <th className="px-4 py-3 text-left">Who</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-right">Day rate</th>
                  <th className="px-4 py-3 text-right">Work days</th>
                  <th className="px-4 py-3 text-right">Alloc</th>
                  <th className="px-4 py-3 text-right">Days</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line [font-variant-numeric:tabular-nums]">
                {c.resourceLines.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-body">{r.phase}</td>
                    <td className="px-4 py-3 text-ink">{r.name}</td>
                    <td className="px-4 py-3 text-body">{r.role}</td>
                    <td className="px-4 py-3 text-right text-body">{r.dayRate ? aed(r.dayRate) : <span className="text-bad">no rate</span>}</td>
                    <td className="px-4 py-3 text-right text-body">{r.workDays}</td>
                    <td className="px-4 py-3 text-right text-body">{r.allocationPct}%</td>
                    <td className="px-4 py-3 text-right text-body">{Math.round(r.days * 10) / 10}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{aed(r.cost)}</td>
                  </tr>
                ))}
                {c.resourceLines.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted">No phases yet — edit the sheet to add one.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Third-party */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-bold uppercase tracking-wider text-ink">Third-party costs</h2>
          <span className="text-sm font-semibold text-muted [font-variant-numeric:tabular-nums]">
            {aed(c.vendor)}
            {sheet.waitingVendor && <span className="ml-2 text-xs font-normal text-warn">waiting for vendor prices</span>}
          </span>
        </div>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 text-left">Who</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Cost to HS</th>
                  <th className="px-4 py-3 text-right">Markup</th>
                  <th className="px-4 py-3 text-right">Markup AED</th>
                  <th className="px-4 py-3 text-right">Charged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line [font-variant-numeric:tabular-nums]">
                {c.vendorLines.map((v, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-semibold text-ink">{v.vendorName || '—'}</td>
                    <td className="px-4 py-3 text-body">{v.description}</td>
                    <td className="px-4 py-3 text-right text-body">{aed(v.cost)}</td>
                    <td className="px-4 py-3 text-right text-body">{pct(v.markupPct)}</td>
                    <td className="px-4 py-3 text-right text-body">{aed(v.markupAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{aed(v.total)}</td>
                  </tr>
                ))}
                {c.vendorLines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                      {sheet.waitingVendor ? 'Waiting for vendor prices.' : 'No third-party costs.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {canEdit && editOpen && (
        <PricingSheetModal sheet={sheet} services={services} onClose={() => setEditOpen(false)} />
      )}
    </>
  )
}
