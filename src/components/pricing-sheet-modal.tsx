'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PricingSheetDTO } from '@/lib/services/pricing'
import { TIER_OPTIONS } from '@/lib/project-constants'
import { updatePricingSheetAction } from '@/app/actions/pricing'
import { Alert } from '@/components/ui'

interface PricingSheetModalProps {
  sheet: PricingSheetDTO
  services: { id: string; name: string }[]
  onClose: () => void
}

type ResourceRow = { name: string; role: string; serviceId: string; allocationPct: number }
type PhaseRow = { name: string; workDays: number; resources: ResourceRow[] }
type VendorRow = { vendorName: string; description: string; cost: number; markupPct: number }

const field = 'w-full rounded-field border border-line-2 bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent'
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted'

export default function PricingSheetModal({ sheet, services, onClose }: PricingSheetModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [tier, setTier] = useState(sheet.tier)
  const [tePct, setTePct] = useState(String(Math.round(sheet.tePct * 100)))
  const [adminPct, setAdminPct] = useState(String(Math.round(sheet.adminPct * 100)))
  const [waitingVendor, setWaitingVendor] = useState(sheet.waitingVendor)
  const [phases, setPhases] = useState<PhaseRow[]>(
    sheet.phases.map((p) => ({
      name: p.name,
      workDays: p.workDays,
      resources: p.resources.map((r) => ({ name: r.name, role: r.role, serviceId: r.serviceId ?? '', allocationPct: r.allocationPct })),
    })),
  )
  const [vendors, setVendors] = useState<VendorRow[]>(
    sheet.thirdParty.map((t) => ({ vendorName: t.vendorName, description: t.description, cost: t.cost, markupPct: Math.round(t.markupPct * 100) })),
  )

  function setPhase(i: number, patch: Partial<PhaseRow>) {
    setPhases((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function setResource(pi: number, ri: number, patch: Partial<ResourceRow>) {
    setPhases((rows) =>
      rows.map((p, idx) =>
        idx === pi ? { ...p, resources: p.resources.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : p,
      ),
    )
  }
  function setVendor(i: number, patch: Partial<VendorRow>) {
    setVendors((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function save() {
    setError(null)
    const fd = new FormData()
    fd.set('projectId', sheet.projectId)
    fd.set('tier', tier)
    fd.set('tePct', tePct)
    fd.set('adminPct', adminPct)
    if (waitingVendor) fd.set('waitingVendor', 'on')
    fd.set(
      'phasesJson',
      JSON.stringify(
        phases
          .filter((p) => p.name.trim())
          .map((p) => ({
            name: p.name,
            workDays: p.workDays || 0,
            resources: p.resources.filter((r) => r.name.trim() && r.role.trim()),
          })),
      ),
    )
    fd.set('thirdPartyJson', JSON.stringify(vendors.filter((v) => v.description.trim())))

    startTransition(async () => {
      const res = await updatePricingSheetAction(null, fd)
      if (res?.error) setError(res.error)
      else if (res?.fieldErrors) setError('Some rows are incomplete — check names and descriptions.')
      else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-card border border-line-2 bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-ink">Edit pricing sheet</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current [stroke-width:2]">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelCls}>Tier</label>
            <select value={tier} onChange={(e) => setTier(e.target.value as PricingSheetDTO['tier'])} className={field}>
              {TIER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>T&amp;E %</label>
            <input type="number" min={0} max={100} value={tePct} onChange={(e) => setTePct(e.target.value)} className={field} />
          </div>
          <div>
            <label className={labelCls}>Admin %</label>
            <input type="number" min={0} max={100} value={adminPct} onChange={(e) => setAdminPct(e.target.value)} className={field} />
          </div>
          <label className="flex items-end gap-2 pb-1.5 text-sm text-body">
            <input type="checkbox" checked={waitingVendor} onChange={(e) => setWaitingVendor(e.target.checked)} className="h-4 w-4" />
            Waiting on vendor
          </label>
        </div>

        {/* Phases */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold uppercase tracking-[.04em] text-ink">Phases &amp; resourcing</span>
            <button
              type="button"
              onClick={() => setPhases((r) => [...r, { name: '', workDays: 0, resources: [] }])}
              className="text-xs font-semibold text-accent hover:underline"
            >
              + Add phase
            </button>
          </div>
          <div className="space-y-3">
            {phases.map((p, pi) => (
              <div key={pi} className="rounded-field border border-line bg-surface-2 p-3">
                <div className="flex gap-2">
                  <input value={p.name} onChange={(e) => setPhase(pi, { name: e.target.value })} placeholder="Phase name" className={field} />
                  <input
                    type="number"
                    min={0}
                    value={p.workDays}
                    onChange={(e) => setPhase(pi, { workDays: Number(e.target.value) })}
                    placeholder="Work days"
                    className={`${field} w-28 shrink-0`}
                  />
                  <button type="button" onClick={() => setPhases((r) => r.filter((_, i) => i !== pi))} className="shrink-0 text-muted hover:text-bad" title="Remove phase">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <div className="mt-2 space-y-2 pl-3">
                  {p.resources.map((r, ri) => (
                    <div key={ri} className="flex gap-2">
                      <input value={r.name} onChange={(e) => setResource(pi, ri, { name: e.target.value })} placeholder="Who" className={`${field} w-32 shrink-0`} />
                      <select
                        value={r.serviceId || r.role}
                        onChange={(e) => {
                          const svc = services.find((s) => s.id === e.target.value)
                          if (svc) setResource(pi, ri, { serviceId: svc.id, role: svc.name })
                          else setResource(pi, ri, { serviceId: '', role: e.target.value })
                        }}
                        className={field}
                      >
                        {!services.some((s) => s.id === r.serviceId) && r.role && (
                          <option value={r.role}>{r.role} (no rate)</option>
                        )}
                        <option value="">— pick a role —</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={r.allocationPct}
                        onChange={(e) => setResource(pi, ri, { allocationPct: Number(e.target.value) })}
                        className={`${field} w-20 shrink-0`}
                        title="Allocation %"
                      />
                      <button
                        type="button"
                        onClick={() => setPhase(pi, { resources: p.resources.filter((_, i) => i !== ri) })}
                        className="shrink-0 text-muted hover:text-bad"
                        title="Remove resource"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPhase(pi, { resources: [...p.resources, { name: '', role: '', serviceId: '', allocationPct: 100 }] })}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    + Add resource
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Third-party */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold uppercase tracking-[.04em] text-ink">Third-party costs</span>
            <button
              type="button"
              onClick={() => setVendors((r) => [...r, { vendorName: '', description: '', cost: 0, markupPct: 40 }])}
              className="text-xs font-semibold text-accent hover:underline"
            >
              + Add cost
            </button>
          </div>
          <div className="space-y-2">
            {vendors.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input value={v.vendorName} onChange={(e) => setVendor(i, { vendorName: e.target.value })} placeholder="Vendor" className={`${field} w-32 shrink-0`} />
                <input value={v.description} onChange={(e) => setVendor(i, { description: e.target.value })} placeholder="Description" className={field} />
                <input
                  type="number"
                  min={0}
                  value={v.cost}
                  onChange={(e) => setVendor(i, { cost: Number(e.target.value) })}
                  placeholder="Cost AED"
                  className={`${field} w-28 shrink-0`}
                />
                <input
                  type="number"
                  min={0}
                  value={v.markupPct}
                  onChange={(e) => setVendor(i, { markupPct: Number(e.target.value) })}
                  placeholder="Markup %"
                  className={`${field} w-24 shrink-0`}
                />
                <button type="button" onClick={() => setVendors((r) => r.filter((_, idx) => idx !== i))} className="shrink-0 text-muted hover:text-bad" title="Remove">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-4">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-field border border-line-2 px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={isPending} className="rounded-field bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-press disabled:opacity-50">
            {isPending ? 'Saving…' : 'Save sheet'}
          </button>
        </div>
      </div>
    </div>
  )
}
