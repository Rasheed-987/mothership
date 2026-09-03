'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import type { ProjectDetailDTO, ProjectResourceDTO } from '@/lib/services/projects'
import {
  PROJECT_CATEGORIES,
  PROJECT_STATUS_OPTIONS,
  PROJECT_HEALTH_OPTIONS,
  RESOURCE_KIND_OPTIONS,
} from '@/lib/project-constants'
import { createProjectAction, updateProjectAction, deleteProjectAction } from '@/app/actions/projects'
import { FieldError, Alert } from '@/components/ui'

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
  project?: ProjectDetailDTO | null
  clientOptions?: { id: string; name: string }[]
  teamOptions?: { id: string; name: string }[]
  /** Called after a successful delete; defaults to onClose. */
  onDeleted?: () => void
}

const field =
  'w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent'
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted'

function isoToDateInput(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : ''
}

export default function ProjectModal({
  isOpen,
  onClose,
  project,
  clientOptions = [],
  teamOptions = [],
  onDeleted,
}: ProjectModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>()
  const [resources, setResources] = useState<ProjectResourceDTO[]>([])

  const isEditing = Boolean(project)

  useEffect(() => {
    setResources(project?.resources ?? [])
    setError(null)
    setFieldErrors(undefined)
  }, [project, isOpen])

  if (!isOpen) return null

  function setResource(i: number, patch: Partial<ProjectResourceDTO>) {
    setResources((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(formData: FormData) {
    formData.set('resourcesJson', JSON.stringify(resources.filter((r) => r.label.trim() && r.url.trim())))
    setError(null)
    setFieldErrors(undefined)

    startTransition(async () => {
      const res = isEditing
        ? await updateProjectAction(null, formData)
        : await createProjectAction(null, formData)

      if (res?.error) setError(res.error)
      else if (res?.fieldErrors) setFieldErrors(res.fieldErrors)
      else onClose()
    })
  }

  function handleDelete() {
    if (!project) return
    if (!confirm(`Delete ${project.name}? This cannot be undone.`)) return

    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('projectId', project.id)
      const res = await deleteProjectAction(null, formData)
      if (res?.error) setError(res.error)
      else (onDeleted ?? onClose)()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-card border border-line-2 bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-ink">{isEditing ? 'Edit project' : 'New project'}</h2>
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
          {isEditing && <input type="hidden" name="projectId" value={project?.id} />}

          <div>
            <label className={labelCls}>Project name</label>
            <input name="name" required defaultValue={project?.name || ''} placeholder="Brand Uplift for…" className={field} />
            <FieldError errors={fieldErrors?.name} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Client</label>
              <select name="clientId" required defaultValue={project?.clientId || ''} className={field}>
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
              <label className={labelCls}>Category</label>
              <select name="category" defaultValue={project?.category || 'Creative'} className={field}>
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
              <label className={labelCls}>Status</label>
              <select name="status" defaultValue={project?.status || 'active'} className={field}>
                {PROJECT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Health</label>
              <select name="health" defaultValue={project?.health || 'on_track'} className={field}>
                {PROJECT_HEALTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Days behind</label>
              <input name="daysBehind" type="number" min={0} defaultValue={project?.daysBehind ?? 0} className={field} />
            </div>
            <div>
              <label className={labelCls}>Revisions</label>
              <input name="revisionRounds" type="number" min={0} defaultValue={project?.revisionRounds ?? 0} className={field} />
            </div>
            <div>
              <label className={labelCls}>Duration</label>
              <input name="plannedDuration" defaultValue={project?.plannedDuration || ''} placeholder="12 weeks" className={field} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start date</label>
              <input name="startDate" type="date" defaultValue={isoToDateInput(project?.startDate)} className={field} />
            </div>
            <div>
              <label className={labelCls}>Completion date</label>
              <input name="dueDate" type="date" defaultValue={isoToDateInput(project?.dueDate)} className={field} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Value sold (AED)</label>
              <input name="value" type="number" min={0} step={1} defaultValue={project?.value ?? 0} className={field} />
            </div>
            <div>
              <label className={labelCls}>Owner</label>
              <select name="managerId" defaultValue={project?.managerId || ''} className={field}>
                <option value="">Unassigned</option>
                {teamOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Progress note</label>
            <input
              name="progressNote"
              defaultValue={project?.progressNote || ''}
              placeholder="Awaiting asset sign-off, slipping"
              className={field}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={labelCls}>Resources</label>
              <button
                type="button"
                onClick={() => setResources((r) => [...r, { label: '', url: '', kind: 'drive' }])}
                className="text-xs font-semibold text-accent hover:underline"
              >
                + Add link
              </button>
            </div>
            <div className="space-y-2">
              {resources.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={r.label}
                    onChange={(e) => setResource(i, { label: e.target.value })}
                    placeholder="Label"
                    className={`${field} w-28 shrink-0`}
                  />
                  <input
                    value={r.url}
                    onChange={(e) => setResource(i, { url: e.target.value })}
                    placeholder="https://…"
                    className={field}
                  />
                  <select
                    value={r.kind}
                    onChange={(e) => setResource(i, { kind: e.target.value as ProjectResourceDTO['kind'] })}
                    className={`${field} w-24 shrink-0`}
                  >
                    {RESOURCE_KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setResources((rows) => rows.filter((_, idx) => idx !== i))}
                    className="shrink-0 text-muted hover:text-bad"
                    title="Remove"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Remarks / internal note</label>
            <textarea name="remarks" defaultValue={project?.remarks || ''} rows={2} placeholder="Largest active account." className={field} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea name="description" defaultValue={project?.description || ''} rows={2} className={field} />
          </div>

          <label className="flex items-center gap-2 text-sm text-body">
            <input type="checkbox" name="clientVisible" defaultChecked={project?.clientVisible ?? false} className="h-4 w-4" />
            Client can see the live tracker
          </label>

          <p className="text-xs text-muted">
            The client contact shown on the page is the primary contact on{' '}
            {project ? (
              <Link href={`/dashboard/clients/${project.clientId}`} className="font-semibold text-accent hover:underline">
                {project.clientName}
              </Link>
            ) : (
              'the client record'
            )}
            .
          </p>

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
                Delete project
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
                {isPending ? 'Saving…' : isEditing ? 'Save project' : 'Create project'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
