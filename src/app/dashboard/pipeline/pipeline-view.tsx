'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { aed, aedShort, avTint, initials, fmtDate, fmtDay } from '@/lib/demo-format'
import type { DealDTO, PipelineDTO } from '@/lib/services/deals'
import { addDealNoteAction } from '@/app/actions/deals'
import DealModal from '@/components/deal-modal'

interface PipelineViewProps {
  pipeline: PipelineDTO
  canEdit?: boolean
  canCreate?: boolean
  clientOptions?: { id: string; name: string }[]
  teamOptions?: { id: string; name: string }[]
}

const BAR_TRACK = '#E4DEF8'
const BAR_FILL = '#6B4FE6'

function statusPill(d: DealDTO) {
  const cls =
    d.stage === 'proposal'
      ? d.confidence === 'high'
        ? 'bg-[rgba(107,79,230,.13)] text-[#5B40D6]'
        : 'bg-[rgba(124,92,255,.13)] text-[#7C5CE6]'
      : 'bg-surface-3 text-muted'
  return <span className={`inline-flex h-[25px] items-center whitespace-nowrap rounded-full px-[11px] text-xs font-semibold ${cls}`}>{d.statusLabel}</span>
}

/* ---- bar chart (magnitude across 3 fixed buckets; one hue, solid = prob-adjusted) ---- */
function PipelineBars({ totals }: { totals: PipelineDTO['totals'] }) {
  const max = Math.max(...totals.buckets.map((b) => b.total), 1)
  return (
    <div className="mb-10 rounded-card border border-line bg-surface p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[.08em] text-faint">Total pipeline</div>
          <div className="font-display text-4xl font-semibold text-ink [font-variant-numeric:tabular-nums]">{aed(totals.total)}</div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAR_FILL }} />
          <span className="font-semibold text-ink [font-variant-numeric:tabular-nums]">{aed(totals.adjusted)}</span>
          <span className="text-muted">probability-adjusted</span>
        </div>
      </div>

      <div className="flex items-end justify-around gap-6" style={{ height: 200 }}>
        {totals.buckets.map((b) => {
          const barH = Math.max((b.total / max) * 150, 3)
          const fillPct = b.total ? (b.adjusted / b.total) * 100 : 0
          const adjPct = b.total ? Math.round((b.adjusted / b.total) * 100) : 0
          return (
            <div key={b.key} className="flex flex-1 flex-col items-center justify-end">
              <div className="mb-2 text-xs font-bold text-ink [font-variant-numeric:tabular-nums]">{aedShort(b.total)}</div>
              <div
                className="flex w-full max-w-[90px] flex-col justify-end overflow-hidden rounded-t-[4px]"
                style={{ height: barH, background: BAR_TRACK }}
                title={`${b.label} — ${aedShort(b.total)} total · ${aedShort(b.adjusted)} adjusted (${adjPct}%)`}
              >
                <div className="w-full" style={{ height: `${fillPct}%`, background: BAR_FILL }} />
              </div>
              <div className="mt-3 text-center text-xs text-muted">{b.label}</div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-4 border-t border-line pt-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: BAR_FILL }} /> Probability-adjusted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: BAR_TRACK }} /> Total value
        </span>
      </div>
    </div>
  )
}

/* ---- inline "add note" box ---- */
function NoteBox({ dealId }: { dealId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-field border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current [stroke-width:2]">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add note
      </button>
    )
  }

  function save() {
    if (!text.trim()) return
    const fd = new FormData()
    fd.set('dealId', dealId)
    fd.set('text', text)
    startTransition(async () => {
      const res = await addDealNoteAction(null, fd)
      if (!res?.error && !res?.fieldErrors) {
        setText('')
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Log a call, email or update…"
        className="w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save()
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-field bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Add note'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-field border border-line-2 px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2">
          Cancel
        </button>
        <span className="text-xs text-faint">Timestamped {fmtDay(new Date().toISOString())}</span>
      </div>
    </div>
  )
}

function DealRow({
  d,
  open,
  onToggle,
  onEdit,
}: {
  d: DealDTO
  open: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const facts: [string, ReactNode][] = [
    ['Value', aed(d.value)],
    ['Probability', `${d.probability}%`],
    ['Prob-adjusted', aed(d.adjustedValue)],
    ['Confidence', d.confidence === 'high' ? 'High' : 'Low'],
    ['Owner', d.ownerName || '—'],
    ['Industry', d.industry],
    ['Country', d.country],
    ['Created', fmtDate(d.createdAt)],
    ['Last update', d.lastUpdate ? fmtDate(d.lastUpdate) : '—'],
    ['Next follow-up', d.nextFollowUpDate ? fmtDate(d.nextFollowUpDate) : '—'],
  ]

  return (
    <>
      <tr
        onClick={onToggle}
        className={`group cursor-pointer border-l-2 transition-colors hover:bg-surface-2 ${
          d.overdueDays != null ? 'border-accent' : 'border-transparent'
        } ${open ? 'bg-surface-2' : ''}`}
      >
        <td className="px-4 py-4 text-sm font-semibold text-ink">
          <div className="flex min-w-0 items-center gap-[11px]">
            <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avTint(d.clientName)}`}>
              {initials(d.clientName)}
            </span>
            <div className="min-w-0">
              <div className="truncate">{d.clientName}</div>
              {d.overdueDays != null && (
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[rgba(224,57,43,.1)] px-1.5 py-0.5 text-[10.5px] font-semibold text-bad">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-current [stroke-width:2]">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  {d.overdueDays}d overdue
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-4 text-sm text-body">{d.title}</td>
        <td className="px-4 py-4">
          <span className="inline-flex h-6 items-center whitespace-nowrap rounded-[20px] border border-line bg-surface-3 px-2.5 text-[11px] font-semibold text-ink-2">
            {d.category}
          </span>
        </td>
        <td className="px-4 py-4">{statusPill(d)}</td>
        <td className="px-4 py-4 text-sm font-semibold text-ink [font-variant-numeric:tabular-nums]">{aed(d.value)}</td>
        <td className="px-4 py-4 text-sm text-body">{d.confidence === 'high' ? 'High' : 'Low'}</td>
        <td className="px-4 py-4 text-right text-muted">
          <svg viewBox="0 0 24 24" className={`ml-auto h-4 w-4 fill-none stroke-current [stroke-width:2] transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </td>
      </tr>
      {open && (
        <tr className="bg-surface-2">
          <td colSpan={7} className="px-4 pb-5 pt-1">
            <div className="rounded-card border border-line bg-surface p-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[10px] font-bold uppercase tracking-[.06em] text-faint">{k}</div>
                    <div className="mt-0.5 text-sm font-semibold text-ink [font-variant-numeric:tabular-nums]">{v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[.08em] text-faint">Notes &amp; activity</div>
                {d.notes.length > 0 ? (
                  <ul className="space-y-2">
                    {d.notes.map((n, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="w-16 shrink-0 font-bold text-accent">{fmtDay(n.at)}</span>
                        <span className="text-body">{n.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{d.source || 'No notes recorded.'}</p>
                )}
                <NoteBox dealId={d.id} />
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 rounded-field border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current [stroke-width:2]">
                    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                    <path d="M14 6l4 4" />
                  </svg>
                  Edit
                </button>
                {d.convertedProjectId && (
                  <Link
                    href={`/dashboard/projects/${d.convertedProjectId}`}
                    className="inline-flex items-center gap-1.5 rounded-field border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current [stroke-width:2]">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Open project
                  </Link>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const THEAD = (
  <thead>
    <tr className="border-b border-line bg-surface-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">
      <th className="px-4 py-3 text-left">Client</th>
      <th className="px-4 py-3 text-left">Project</th>
      <th className="px-4 py-3 text-left">Service</th>
      <th className="px-4 py-3 text-left">Status</th>
      <th className="px-4 py-3 text-left">Value</th>
      <th className="px-4 py-3 text-left">Confidence</th>
      <th className="w-8 px-4 py-3" />
    </tr>
  </thead>
)

export default function PipelineView({
  pipeline,
  canEdit = false,
  canCreate = false,
  clientOptions = [],
  teamOptions = [],
}: PipelineViewProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<DealDTO | null>(null)

  const toggle = (id: string) =>
    setOpenIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const openEdit = (d: DealDTO) => {
    setEditingDeal(d)
    setModalOpen(true)
  }

  function exportCsv() {
    const all = [...pipeline.followUps, ...pipeline.rest]
    const rows = [
      ['Client', 'Project', 'Service', 'Status', 'Confidence', 'Value (AED)', 'Probability', 'Adjusted (AED)', 'Last update', 'Next follow-up'],
      ...all.map((d) => [
        d.clientName,
        d.title,
        d.category,
        d.statusLabel,
        d.confidence === 'high' ? 'High' : 'Low',
        String(Math.round(d.value)),
        `${d.probability}%`,
        String(d.adjustedValue),
        d.lastUpdate ? fmtDate(d.lastUpdate) : '',
        d.nextFollowUpDate ? fmtDate(d.nextFollowUpDate) : '',
      ]),
    ]
    const csv = rows
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
      .join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv)
    a.download = 'sales-pipeline.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const renderTable = (list: DealDTO[]) =>
    list.length > 0 ? (
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {THEAD}
            <tbody className="divide-y divide-line">
              {list.map((d) => (
                <DealRow key={d.id} d={d} open={openIds.has(d.id)} onToggle={() => toggle(d.id)} onEdit={() => openEdit(d)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : null

  return (
    <>
      <PageHeader
        title="Sales pipeline"
        description="Every open opportunity, probability-adjusted. Overdue follow-ups float to the top."
        action={
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-field border border-line-2 bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-surface-2"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Export · Excel
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setEditingDeal(null)
                  setModalOpen(true)
                }}
                className="flex items-center gap-2 rounded-field bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-press"
              >
                <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New deal
              </button>
            )}
          </div>
        }
      />

      <PipelineBars totals={pipeline.totals} />

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold uppercase tracking-wider text-ink">Needs follow-up</h2>
          <span className="text-xs font-medium text-muted">
            {pipeline.followUps.length
              ? `${pipeline.followUps.length} overdue · reach out to keep these moving`
              : 'nothing overdue'}
          </span>
        </div>
        {renderTable(pipeline.followUps) ?? (
          <div className="rounded-card border border-line bg-surface p-10 text-center text-sm text-muted">
            Nothing overdue — every conversation is current.
          </div>
        )}
      </section>

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold uppercase tracking-wider text-ink">All opportunities</h2>
          <span className="text-xs font-medium text-muted">
            {pipeline.rest.length} in play · {pipeline.followUps.length} flagged above
          </span>
        </div>
        {renderTable(pipeline.rest) ?? (
          <div className="rounded-card border border-line bg-surface p-10 text-center text-sm text-muted">
            All open opportunities are flagged for follow-up above.
          </div>
        )}
      </section>

      {(canEdit || canCreate) && (
        <DealModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          deal={editingDeal}
          clientOptions={clientOptions}
          teamOptions={teamOptions}
        />
      )}
    </>
  )
}
