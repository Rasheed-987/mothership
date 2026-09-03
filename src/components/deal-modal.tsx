'use client'

import { useState, useTransition, useEffect } from 'react'
import type { DealDTO } from '@/lib/services/deals'
import {
  DEAL_STAGE_OPTIONS,
  DEAL_CONFIDENCE_OPTIONS,
  suggestProbability,
  DEAL_STAGE_LABELS,
} from '@/lib/deal-constants'
import { PROJECT_CATEGORIES } from '@/lib/project-constants'
import { createDealAction, updateDealAction, deleteDealAction } from '@/app/actions/deals'
import { FieldError, Alert } from '@/components/ui'

interface DealModalProps {
  isOpen: boolean
  onClose: () => void
  deal?: DealDTO | null
  clientOptions?: { id: string; name: string }[]
  teamOptions?: { id: string; name: string }[]
  onDeleted?: () => void
}

const field =
  'w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent'
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted'
const isoDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')

export default function DealModal({
  isOpen,
  onClose,
  deal,
  clientOptions = [],
  teamOptions = [],
  onDeleted,
}: DealModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>()

  const [stage, setStage] = useState('lead')
  const [confidence, setConfidence] = useState('high')
  const [probability, setProbability] = useState('10')
  const [probTouched, setProbTouched] = useState(false)

  const isEditing = Boolean(deal)

  useEffect(() => {
    setStage(deal?.stage ?? 'lead')
    setConfidence(deal?.confidence ?? 'high')
    setProbability(String(deal?.probability ?? suggestProbability(deal?.stage ?? 'lead', deal?.confidence ?? 'high')))
    setProbTouched(Boolean(deal))
    setError(null)
    setFieldErrors(undefined)
  }, [deal, isOpen])

  if (!isOpen) return null

  const suggested = suggestProbability(stage, confidence)

  function onStageOrConfidence(nextStage: string, nextConfidence: string) {
    setStage(nextStage)
    setConfidence(nextConfidence)
    if (!probTouched) setProbability(String(suggestProbability(nextStage, nextConfidence)))
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setFieldErrors(undefined)
    startTransition(async () => {
      const res = isEditing
        ? await updateDealAction(null, formData)
        : await createDealAction(null, formData)
      if (res?.error) setError(res.error)
      else if (res?.fieldErrors) setFieldErrors(res.fieldErrors)
      else onClose()
    })
  }

  function handleDelete() {
    if (!deal) return
    if (!confirm(`Delete the ${deal.title} opportunity? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('dealId', deal.id)
      const res = await deleteDealAction(null, formData)
      if (res?.error) setError(res.error)
      else (onDeleted ?? onClose)()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-card border border-line-2 bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-ink">{isEditing ? 'Edit opportunity' : 'New opportunity'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current [stroke-width:2]">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          {isEditing && <input type="hidden" name="dealId" value={deal?.id} />}

          <div>
            <label className={labelCls}>Opportunity / project name</label>
            <input name="title" required defaultValue={deal?.title || ''} placeholder="Branding Guidelines" className={field} />
            <FieldError errors={fieldErrors?.title} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Client</label>
              <select name="clientId" required defaultValue={deal?.clientId || ''} className={field}>
                <option value="" disabled>
                  Pick a client…
                </option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError errors={fieldErrors?.clientId} />
            </div>
            <div>
              <label className={labelCls}>Service</label>
              <select name="category" defaultValue={deal?.category || 'Creative'} className={field}>
                {PROJECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Stage</label>
              <select
                name="stage"
                value={stage}
                onChange={(e) => onStageOrConfidence(e.target.value, confidence)}
                className={field}
              >
                {DEAL_STAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Confidence</label>
              <select
                name="confidence"
                value={confidence}
                onChange={(e) => onStageOrConfidence(stage, e.target.value)}
                className={field}
              >
                {DEAL_CONFIDENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Value (AED)</label>
              <input name="value" type="number" min={0} step={1} defaultValue={deal?.value ?? 0} className={field} />
            </div>
            <div>
              <label className={labelCls}>Probability %</label>
              <input
                name="probability"
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => {
                  setProbTouched(true)
                  setProbability(e.target.value)
                }}
                className={field}
              />
              <p className="mt-1 text-xs text-muted">
                Suggested for {DEAL_STAGE_LABELS[stage] ?? stage}
                {stage === 'proposal' ? ` · ${confidence}` : ''}: {suggested}%
                {String(suggested) !== probability && (
                  <button
                    type="button"
                    onClick={() => {
                      setProbTouched(false)
                      setProbability(String(suggested))
                    }}
                    className="ml-1 font-semibold text-accent hover:underline"
                  >
                    use
                  </button>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Owner</label>
              <select name="ownerId" defaultValue={deal?.ownerId || ''} className={field}>
                <option value="">Unassigned</option>
                {teamOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Next follow-up</label>
              <input name="nextFollowUpDate" type="date" defaultValue={isoDate(deal?.nextFollowUpDate)} className={field} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Expected close</label>
              <input name="expectedCloseDate" type="date" defaultValue={isoDate(deal?.expectedCloseDate)} className={field} />
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <input name="source" defaultValue={deal?.source || ''} placeholder="Referral, RFP, inbound…" className={field} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-bad hover:underline disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete opportunity
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-field border border-line-2 px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-field bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-press disabled:opacity-50"
              >
                {isPending ? 'Saving…' : isEditing ? 'Save opportunity' : 'Create opportunity'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
