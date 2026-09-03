'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { aed, fmtDate, fmtDay, fmtLong } from '@/lib/demo-format'
import type {
  ProjectDetailDTO,
  ProjectStageDTO,
  ProjectResourceDTO,
} from '@/lib/services/projects'
import ProjectModal from '@/components/project-modal'
import ProjectTrackerModal from '@/components/project-tracker-modal'

const AGENCY = 'Human Saucer'

interface ProjectDetailViewProps {
  project: ProjectDetailDTO
  canEdit?: boolean
  clientOptions?: { id: string; name: string }[]
  teamOptions?: { id: string; name: string }[]
}

type Cap = { label: string; className: string; icon: 'check' | 'clock' | 'alert' }

function healthCap(p: ProjectDetailDTO): Cap {
  if (p.status === 'completed') return { label: 'Completed', className: 'bg-surface-3 text-muted', icon: 'check' }
  if (p.status === 'cancelled') return { label: 'Cancelled', className: 'bg-[rgba(224,57,43,.12)] text-bad', icon: 'alert' }
  if (p.status === 'on_hold') return { label: 'On hold', className: 'bg-surface-3 text-muted', icon: 'clock' }
  if (p.status === 'planning') return { label: 'Planning', className: 'bg-surface-3 text-muted', icon: 'clock' }
  if (p.health === 'behind') {
    return p.daysBehind > 7
      ? { label: 'Delayed', className: 'bg-[rgba(224,57,43,.12)] text-bad', icon: 'alert' }
      : { label: 'Behind schedule', className: 'bg-[rgba(217,131,31,.15)] text-[#C2741A]', icon: 'clock' }
  }
  return { label: 'On track', className: 'bg-[rgba(30,158,106,.13)] text-ok', icon: 'check' }
}

const ICON: Record<Cap['icon'], ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 2.5 20h19L12 4z" />
      <path d="M12 10v4M12 17.5v.5" />
    </>
  ),
}

function CapPill({ cap }: { cap: Cap }) {
  return (
    <span className={`inline-flex h-[25px] items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] text-xs font-semibold ${cap.className}`}>
      <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.2]">
        {ICON[cap.icon]}
      </svg>
      {cap.label}
    </span>
  )
}

function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="h-3.5 w-3.5 shrink-0 rounded-[3px] bg-accent" />
      <h2 className="font-display text-2xl font-semibold uppercase tracking-[.01em] text-ink">{children}</h2>
    </div>
  )
}

function InfoCard({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-5 ${className}`}>
      <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[.08em] text-faint">{label}</div>
      {children}
    </div>
  )
}

const RESOURCE_ICON: Record<ProjectResourceDTO['kind'], ReactNode> = {
  drive: (
    <svg viewBox="0 0 87.3 78" className="h-4 w-4" aria-hidden>
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5C.4 49.9 0 51.45 0 53h27.5z" fill="#00ac47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335" />
      <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="M73.4 26.5L60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  ),
  figma: (
    <svg viewBox="0 0 38 57" className="h-3.5 w-3.5" aria-hidden>
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1abcfe" />
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0acf83" />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19z" fill="#ff7262" />
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#f24e1e" />
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#a259ff" />
    </svg>
  ),
  proposal: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-muted [stroke-width:2]" aria-hidden>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
  other: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-muted [stroke-width:2]" aria-hidden>
      <path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />
    </svg>
  ),
}

function stageIcon(state: ProjectStageDTO['state']): ReactNode {
  if (state === 'done') return <path d="M5 12.5l4.5 4.5L19 7.5" />
  if (state === 'active') return <path d="M12 3l2.2 6.2L20 11l-5.8 1.8L12 19l-2.2-6.2L4 11l5.8-1.8z" />
  return (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  )
}

export default function ProjectDetailView({
  project,
  canEdit = true,
  clientOptions = [],
  teamOptions = [],
}: ProjectDetailViewProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)

  const cap = healthCap(project)
  const contact = project.clientContact

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
            <path d="M15 19l-7-7 7-7" />
          </svg>
          All projects
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8 border-b border-line pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/dashboard/clients/${project.clientId}`}
              className="text-sm font-semibold text-muted transition-colors hover:text-accent"
            >
              {project.clientName}
            </Link>
            <h1 className="mt-1 font-display text-4xl font-semibold uppercase leading-[.95] tracking-[.01em] text-ink">
              {project.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CapPill cap={cap} />
              <span className="inline-flex h-[25px] items-center rounded-full bg-surface-3 px-[11px] text-xs font-semibold text-ink-2">
                {project.category}
              </span>
              <span className="inline-flex h-[25px] items-center gap-1.5 rounded-full bg-[rgba(224,57,43,.1)] px-[11px] text-xs font-semibold text-bad">
                <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-none stroke-current [stroke-width:2]">
                  <path d="M6 10V8a6 6 0 1112 0v2M5 10h14v10H5z" />
                </svg>
                Internal only
              </span>
            </div>
          </div>

          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setTrackerOpen(true)}
                className="flex items-center gap-2 rounded-field border border-line-2 bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                  <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" />
                </svg>
                Update tracker
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 rounded-field border border-line-2 bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                  <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                  <path d="M14 6l4 4" />
                </svg>
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Facts */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Value', aed(project.value)],
          ['Owner', project.ownerName || '—'],
          ['Industry', project.industry],
          ['Country', project.country],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card border border-line bg-surface p-4">
            <div className="text-[10.5px] font-bold uppercase tracking-[.08em] text-faint">{k}</div>
            <div className="mt-1 text-lg font-bold text-ink [font-variant-numeric:tabular-nums]">{v}</div>
          </div>
        ))}
      </div>

      {/* Cards row */}
      <div className="mb-10 grid gap-4 md:grid-cols-3">
        {contact && (
          <InfoCard label="Client contact">
            {contact.name && <div className="text-sm font-bold text-ink">{contact.name}</div>}
            <div className="mt-2 space-y-1.5">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-body hover:text-accent">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                    <path d="M3 6h18v12H3z" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm text-body hover:text-accent">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                    <path d="M4 4h5l2 5-3 2a12 12 0 006 6l2-3 5 2v5a2 2 0 01-2 2A17 17 0 013 6a2 2 0 011-2z" />
                  </svg>
                  {contact.phone}
                </a>
              )}
            </div>
            <Link href={`/dashboard/clients/${project.clientId}`} className="mt-3 inline-block text-xs font-semibold text-muted hover:text-accent">
              Manage on {project.clientName} →
            </Link>
          </InfoCard>
        )}

        {project.resources.length > 0 && (
          <InfoCard label="Resources">
            <div className="flex flex-wrap gap-2">
              {project.resources.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-field border border-line-2 bg-surface-2 px-2.5 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink"
                >
                  {RESOURCE_ICON[r.kind]}
                  {r.label}
                  <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-faint [stroke-width:2]">
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </a>
              ))}
            </div>
          </InfoCard>
        )}

        {project.pricingSuggested != null && (
          <InfoCard label="Pricing">
            <div className="text-xs text-muted">Suggested price</div>
            <div className="font-display text-3xl font-semibold text-ink [font-variant-numeric:tabular-nums]">
              {aed(project.pricingSuggested)}
            </div>
          </InfoCard>
        )}

        {project.remarks && (
          <InfoCard label="Remarks">
            <p className="text-sm text-body">{project.remarks}</p>
          </InfoCard>
        )}
      </div>

      {/* Where we stand */}
      <section className="mb-10">
        <SectionHead>Where we stand</SectionHead>

        <div className="rounded-card border border-line bg-surface p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-[15px] font-bold uppercase tracking-[.03em] text-ink">Live status</span>
            <div className="flex items-center gap-3 text-xs text-muted">
              {project.revisionRounds > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 font-semibold text-ink-2">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current [stroke-width:2]">
                    <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" />
                  </svg>
                  {project.revisionRounds} revision round{project.revisionRounds === 1 ? '' : 's'}
                </span>
              )}
              {project.trackerUpdatedAt && <span>Updated {fmtDate(project.trackerUpdatedAt)}</span>}
            </div>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-field border border-line bg-surface-2 p-3.5">
              <div className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">Status</div>
              <div className="mt-1.5"><CapPill cap={cap} /></div>
            </div>
            <div className="rounded-field border border-line bg-surface-2 p-3.5">
              <div className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">Days behind</div>
              <div className="mt-1.5">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-sm font-bold [font-variant-numeric:tabular-nums] ${
                    project.daysBehind > 0 ? 'bg-[rgba(224,57,43,.12)] text-bad' : 'bg-surface-3 text-muted'
                  }`}
                >
                  {project.daysBehind} day{project.daysBehind === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <div className="rounded-field border border-line bg-surface-2 p-3.5">
              <div className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">Completion date</div>
              <div className="mt-1.5 text-sm font-bold text-ink">{fmtDate(project.dueDate)}</div>
            </div>
            <div className="rounded-field border border-line bg-surface-2 p-3.5">
              <div className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">Duration</div>
              <div className="mt-1.5 text-sm font-bold text-ink">{project.plannedDuration || '—'}</div>
            </div>
          </div>

          {project.stageTotal > 0 && (
            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-bold text-ink">
                  Stage {project.stageCurrent} of {project.stageTotal} complete
                </span>
                {project.progressNote && <span className="text-muted">{project.progressNote}</span>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-ink"
                  style={{ width: `${project.percentComplete}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {project.activity.length > 0 && (
          <div className="mt-4 rounded-card border border-line bg-surface p-6">
            <div className="mb-4 font-display text-[13px] font-bold uppercase tracking-[.05em] text-ink">Recent activity</div>
            <ul className="divide-y divide-line">
              {project.activity.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="w-20 shrink-0 font-bold text-accent">{fmtDay(a.occurredOn)}</span>
                  <span className="flex-1 text-body">{a.text}</span>
                  {a.pending && (
                    <span className="rounded-full bg-[rgba(224,57,43,.1)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-bad">
                      Pending
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* The plan */}
      {project.stages.length > 0 && (
        <section className="mb-10">
          <SectionHead>The plan</SectionHead>

          <div className="mb-5 flex flex-wrap gap-4 text-xs font-semibold text-muted">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-ok" /> Done</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-accent" /> In progress</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-surface-3" /> Upcoming</span>
          </div>

          <ol className="relative space-y-1 before:absolute before:left-[19px] before:top-3 before:bottom-3 before:w-px before:bg-line before:content-['']">
            {project.stages.map((s, i) => {
              const when = s.duration || (s.targetDate ? fmtDay(s.targetDate) : '')
              return (
                <li key={i} className="relative flex gap-4 py-3">
                  <span
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${
                      s.state === 'done'
                        ? 'bg-ok text-white'
                        : s.state === 'active'
                          ? 'bg-gradient-to-br from-accent to-ink text-white'
                          : 'bg-surface-3 text-muted'
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${s.state === 'active' ? 'fill-current stroke-none' : 'fill-none stroke-current [stroke-width:2]'}`}>
                      {stageIcon(s.state)}
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold uppercase tracking-[.01em] text-ink">{s.name}</h3>
                      {s.state === 'done' ? (
                        <span className="rounded-full bg-[rgba(30,158,106,.13)] px-2.5 py-0.5 text-xs font-semibold text-ok">Done</span>
                      ) : s.state === 'active' ? (
                        <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-ink-2">Revising</span>
                      ) : when ? (
                        <span className="text-sm font-semibold text-accent">{when}</span>
                      ) : null}
                    </div>
                    {s.note && <p className="mt-0.5 text-sm text-muted">{s.note}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.owner === AGENCY ? 'bg-[rgba(224,57,43,.1)] text-bad' : 'bg-surface-3 text-ink-2'}`}>
                        {s.owner}
                      </span>
                      {s.duration && s.state !== 'done' && (
                        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-muted">{s.duration}</span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {/* What we need from you */}
      {(project.clientAsks.length > 0 || project.delayNote) && (
        <section className="mb-10">
          <SectionHead>What we need from you</SectionHead>

          {project.clientAsks.length > 0 && (
            <ul className="mb-4 divide-y divide-line rounded-card border border-line bg-surface">
              {project.clientAsks.map((k, i) => (
                <li key={i} className="flex items-start gap-3 p-4">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px] ${k.received ? 'bg-ok' : 'bg-accent'}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-bold ${k.received ? 'text-muted line-through' : 'text-ink'}`}>{k.title}</div>
                    {k.note && <div className="text-sm text-muted">{k.note}</div>}
                  </div>
                  <div className={`shrink-0 text-sm font-semibold ${k.received ? 'text-ok' : 'text-accent'}`}>
                    {k.received ? `✓ ${k.dueOn ? fmtDay(k.dueOn) : 'Received'}` : k.dueOn ? fmtDay(k.dueOn) : '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {project.delayNote && (
            <div className="rounded-r-card border-l-2 border-accent bg-surface px-4 py-3 text-sm text-body shadow-sm">
              {(() => {
                const dot = project.delayNote.indexOf('.')
                if (dot < 0) return <span className="font-bold text-ink">{project.delayNote}</span>
                return (
                  <>
                    <span className="font-bold text-ink">{project.delayNote.slice(0, dot + 1)}</span>
                    {project.delayNote.slice(dot + 1)}
                  </>
                )
              })()}
            </div>
          )}
        </section>
      )}

      {/* Target launch */}
      <section className="-mx-6 mb-2 bg-ink px-6 py-16 text-center">
        <span className="mx-auto mb-4 block h-3.5 w-3.5 rounded-[3px] bg-accent" />
        <div className="text-xs font-semibold uppercase tracking-[.2em] text-white/50">Target launch</div>
        <div className="mt-2 font-display text-5xl font-semibold uppercase tracking-[.01em] text-white sm:text-6xl">
          {fmtLong(project.dueDate)}
        </div>
        <div className="mt-4 text-sm text-white/60">
          Prepared by <b className="text-white">{AGENCY}</b> for <b className="text-white">{project.clientName}</b>
        </div>
      </section>

      {canEdit && (
        <>
          <ProjectModal
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onDeleted={() => router.replace('/dashboard/projects')}
            project={project}
            clientOptions={clientOptions}
            teamOptions={teamOptions}
          />
          <ProjectTrackerModal
            isOpen={trackerOpen}
            onClose={() => setTrackerOpen(false)}
            project={project}
          />
        </>
      )}
    </>
  )
}
