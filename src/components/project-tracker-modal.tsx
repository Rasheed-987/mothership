'use client'

import { useState, useTransition, useEffect } from 'react'
import type { ProjectDetailDTO } from '@/lib/services/projects'
import { STAGE_STATE_OPTIONS } from '@/lib/project-constants'
import { updateTrackerAction } from '@/app/actions/projects'
import { Alert } from '@/components/ui'

interface ProjectTrackerModalProps {
  isOpen: boolean
  onClose: () => void
  project: ProjectDetailDTO
}

type StageRow = { name: string; note: string; owner: string; state: string; targetDate: string; duration: string }
type ActivityRow = { occurredOn: string; text: string; pending: boolean }
type AskRow = { title: string; note: string; dueOn: string; received: boolean }

const field =
  'w-full rounded-field border border-line-2 bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent'
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted'
const iso = (s: string | null) => (s ? s.slice(0, 10) : '')

export default function ProjectTrackerModal({ isOpen, onClose, project }: ProjectTrackerModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [stages, setStages] = useState<StageRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [asks, setAsks] = useState<AskRow[]>([])
  const [progressNote, setProgressNote] = useState('')
  const [delayNote, setDelayNote] = useState('')

  useEffect(() => {
    setStages(
      project.stages.map((s) => ({
        name: s.name,
        note: s.note,
        owner: s.owner,
        state: s.state,
        targetDate: iso(s.targetDate),
        duration: s.duration,
      })),
    )
    setActivity(project.activity.map((a) => ({ occurredOn: iso(a.occurredOn), text: a.text, pending: a.pending })))
    setAsks(project.clientAsks.map((k) => ({ title: k.title, note: k.note, dueOn: iso(k.dueOn), received: k.received })))
    setProgressNote(project.progressNote)
    setDelayNote(project.delayNote)
    setError(null)
  }, [project, isOpen])

  if (!isOpen) return null

  function patch<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number, p: Partial<T>) {
    setter((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  }
  function removeAt<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number) {
    setter((rows) => rows.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    setError(null)
    const formData = new FormData()
    formData.set('projectId', project.id)
    formData.set('progressNote', progressNote)
    formData.set('delayNote', delayNote)
    formData.set('stagesJson', JSON.stringify(stages.filter((s) => s.name.trim())))
    formData.set('activityJson', JSON.stringify(activity.filter((a) => a.text.trim() && a.occurredOn)))
    formData.set('clientAsksJson', JSON.stringify(asks.filter((k) => k.title.trim())))

    startTransition(async () => {
      const res = await updateTrackerAction(null, formData)
      if (res?.error) setError(res.error)
      else if (res?.fieldErrors) setError('Some rows are incomplete — check dates and required text.')
      else onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-card border border-line-2 bg-surface p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-ink">Update tracker</h2>
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
        <p className="mb-5 text-xs text-muted">
          Stage count and % complete are recalculated from the timeline below. Marking a stage “In progress” puts you on
          that stage.
        </p>

        {error && (
          <div className="mb-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        {/* Timeline */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold uppercase tracking-[.04em] text-ink">The plan</span>
            <button
              type="button"
              onClick={() =>
                setStages((r) => [...r, { name: '', note: '', owner: 'Human Saucer', state: 'upcoming', targetDate: '', duration: '' }])
              }
              className="text-xs font-semibold text-accent hover:underline"
            >
              + Add stage
            </button>
          </div>
          <div className="space-y-3">
            {stages.map((s, i) => (
              <div key={i} className="rounded-field border border-line bg-surface-2 p-3">
                <div className="flex gap-2">
                  <input value={s.name} onChange={(e) => patch(setStages, i, { name: e.target.value })} placeholder="Stage name" className={field} />
                  <select value={s.state} onChange={(e) => patch(setStages, i, { state: e.target.value })} className={`${field} w-32 shrink-0`}>
                    {STAGE_STATE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeAt(setStages, i)} className="shrink-0 text-muted hover:text-bad" title="Remove">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <input value={s.note} onChange={(e) => patch(setStages, i, { note: e.target.value })} placeholder="One-line description" className={field} />
                </div>
                <div className="mt-2 flex gap-2">
                  <input value={s.owner} onChange={(e) => patch(setStages, i, { owner: e.target.value })} placeholder="Owner" className={`${field} w-40 shrink-0`} />
                  <input type="date" value={s.targetDate} onChange={(e) => patch(setStages, i, { targetDate: e.target.value })} className={field} />
                  <input value={s.duration} onChange={(e) => patch(setStages, i, { duration: e.target.value })} placeholder="3 weeks" className={`${field} w-28 shrink-0`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className={labelCls}>Progress note</label>
          <input value={progressNote} onChange={(e) => setProgressNote(e.target.value)} placeholder="Awaiting asset sign-off, slipping" className={field} />
        </div>

        {/* Activity */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold uppercase tracking-[.04em] text-ink">Recent activity</span>
            <button
              type="button"
              onClick={() => setActivity((r) => [...r, { occurredOn: '', text: '', pending: false }])}
              className="text-xs font-semibold text-accent hover:underline"
            >
              + Add entry
            </button>
          </div>
          <div className="space-y-2">
            {activity.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="date" value={a.occurredOn} onChange={(e) => patch(setActivity, i, { occurredOn: e.target.value })} className={`${field} w-40 shrink-0`} />
                <input value={a.text} onChange={(e) => patch(setActivity, i, { text: e.target.value })} placeholder="What happened" className={field} />
                <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                  <input type="checkbox" checked={a.pending} onChange={(e) => patch(setActivity, i, { pending: e.target.checked })} />
                  pending
                </label>
                <button type="button" onClick={() => removeAt(setActivity, i)} className="shrink-0 text-muted hover:text-bad" title="Remove">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Client checklist */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold uppercase tracking-[.04em] text-ink">What we need from you</span>
            <button
              type="button"
              onClick={() => setAsks((r) => [...r, { title: '', note: '', dueOn: '', received: false }])}
              className="text-xs font-semibold text-accent hover:underline"
            >
              + Add item
            </button>
          </div>
          <div className="space-y-3">
            {asks.map((k, i) => (
              <div key={i} className="rounded-field border border-line bg-surface-2 p-3">
                <div className="flex gap-2">
                  <input value={k.title} onChange={(e) => patch(setAsks, i, { title: e.target.value })} placeholder="What we need" className={field} />
                  <input type="date" value={k.dueOn} onChange={(e) => patch(setAsks, i, { dueOn: e.target.value })} className={`${field} w-40 shrink-0`} />
                  <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                    <input type="checkbox" checked={k.received} onChange={(e) => patch(setAsks, i, { received: e.target.checked })} />
                    received
                  </label>
                  <button type="button" onClick={() => removeAt(setAsks, i)} className="shrink-0 text-muted hover:text-bad" title="Remove">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <input value={k.note} onChange={(e) => patch(setAsks, i, { note: e.target.value })} placeholder="Why it matters" className={`${field} mt-2`} />
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className={labelCls}>Delay warning</label>
          <textarea
            value={delayNote}
            onChange={(e) => setDelayNote(e.target.value)}
            rows={2}
            placeholder="Identity sign-off is 6 days late. Every day pushes the launch by the same amount."
            className={field}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-field border border-line-2 px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-field bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-press disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save tracker'}
          </button>
        </div>
      </div>
    </div>
  )
}
