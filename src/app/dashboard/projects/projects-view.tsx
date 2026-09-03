'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { aed, avTint, initials } from '@/lib/demo-format'
import { PROJECT_CATEGORIES } from '@/lib/project-constants'
import type { ProjectListDTO } from '@/lib/services/projects'
import ProjectModal from '@/components/project-modal'

/**
 * Projects repository: page head, a Status/Service filter popover, and a table
 * inside a panel — Client / Project / Service / Status / Value rows. Rows link
 * through to the individual project page.
 */

const PROJ_FILTERS = [
  ['active', 'Active projects'],
  ['all', 'All statuses'],
  ['behind', 'Behind'],
  ['ontrack', 'On track'],
  ['pipeline', 'Planning'],
  ['completed', 'Completed'],
] as const

type FilterKey = (typeof PROJ_FILTERS)[number][0]

const isDelivery = (p: ProjectListDTO) =>
  p.status === 'active' || p.status === 'on_hold' || p.status === 'completed'

function deliveryState(p: ProjectListDTO) {
  if (p.status === 'completed') return 'completed'
  if (p.status === 'on_hold') return 'hold'
  if (p.health === 'behind') return p.daysBehind > 7 ? 'delayed' : 'behind'
  return 'ontrack'
}

type Cap = { label: string; className: string; icon?: 'check' | 'clock' | 'alert' }

function statusCap(p: ProjectListDTO): Cap {
  if (isDelivery(p)) {
    const s = deliveryState(p)
    if (s === 'completed') return { label: 'Completed', className: 'bg-surface-3 text-muted', icon: 'check' }
    if (s === 'hold') return { label: 'On hold', className: 'bg-surface-3 text-muted', icon: 'clock' }
    if (s === 'delayed') return { label: 'Delayed', className: 'bg-[rgba(224,57,43,.12)] text-bad', icon: 'alert' }
    if (s === 'behind') return { label: 'Behind schedule', className: 'bg-[rgba(217,131,31,.15)] text-[#C2741A]', icon: 'clock' }
    return { label: 'On track', className: 'bg-[rgba(30,158,106,.13)] text-ok', icon: 'check' }
  }
  if (p.status === 'cancelled') return { label: 'Cancelled', className: 'bg-[rgba(224,57,43,.12)] text-bad', icon: 'alert' }
  return { label: 'Planning', className: 'bg-surface-3 text-muted', icon: 'clock' }
}

const CAP_ICONS = {
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

interface ProjectsViewProps {
  projects: ProjectListDTO[]
  canCreate?: boolean
  clientOptions?: { id: string; name: string }[]
  teamOptions?: { id: string; name: string }[]
}

export default function ProjectsView({
  projects,
  canCreate = false,
  clientOptions = [],
  teamOptions = [],
}: ProjectsViewProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('active')
  const [cat, setCat] = useState('all')
  const [popOpen, setPopOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const statusMatch = (p: ProjectListDTO) => {
    const s = deliveryState(p)
    if (filter === 'active') return isDelivery(p) && p.status !== 'completed'
    if (filter === 'behind') return isDelivery(p) && p.status !== 'completed' && (s === 'behind' || s === 'delayed')
    if (filter === 'ontrack') return isDelivery(p) && p.status !== 'completed' && s === 'ontrack'
    if (filter === 'pipeline') return p.status === 'planning'
    if (filter === 'completed') return p.status === 'completed'
    return p.status !== 'cancelled'
  }

  const list = projects
    .filter((p) => statusMatch(p) && (cat === 'all' || p.category === cat))
    .sort((a, b) => b.value - a.value)

  const nActive = (filter !== 'active' ? 1 : 0) + (cat !== 'all' ? 1 : 0)
  const filterName = PROJ_FILTERS.find(([k]) => k === filter)![1]

  const Option = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-[9px] rounded-[9px] px-2.5 py-2 text-[13.5px] hover:bg-surface-2
        ${on ? 'font-semibold text-ink' : 'text-body'}`}
    >
      <span className="inline-flex h-4 w-4 shrink-0">
        {on && (
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] fill-none stroke-accent [stroke-width:2.6]">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
      {label}
    </div>
  )

  return (
    <>
      <PageHeader
        title="Projects"
        description="The full repository — every entry regardless of stage. Defaults to active projects; use the filter for anything else."
        action={
          canCreate ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-field bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-press"
            >
              <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New project
            </button>
          ) : null
        }
      />

      {/* Filter bar */}
      <div className="mb-[18px] flex items-center gap-3.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPopOpen((v) => !v)}
            className="flex h-[34px] items-center gap-2 rounded-[9px] border border-line-2 bg-surface px-[13px] text-[13px] font-semibold text-body transition-colors hover:border-ink"
          >
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]">
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            Filter{nActive > 0 && ` · ${nActive}`}
          </button>

          {popOpen && (
            <>
              <div className="fixed inset-0 z-[55]" onClick={() => setPopOpen(false)} />
              <div className="absolute left-0 top-[calc(100%+8px)] z-[60] max-h-[70vh] w-[250px] overflow-y-auto rounded-[14px] border border-line bg-surface p-2 shadow-xl">
                <div className="px-2.5 pb-[5px] pt-2.5 text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">
                  Status
                </div>
                {PROJ_FILTERS.map(([k, label]) => (
                  <Option key={k} on={filter === k} label={label} onClick={() => setFilter(k)} />
                ))}
                <div className="px-2.5 pb-[5px] pt-2.5 text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">
                  Service
                </div>
                <Option on={cat === 'all'} label="All services" onClick={() => setCat('all')} />
                {PROJECT_CATEGORIES.map((c) => (
                  <Option key={c} on={cat === c} label={c} onClick={() => setCat(c)} />
                ))}
                <div
                  onClick={() => {
                    setFilter('active')
                    setCat('all')
                  }}
                  className="mx-2 mb-1 mt-1.5 cursor-pointer border-t border-line p-[9px] text-center text-[12.5px] font-semibold text-muted hover:text-accent"
                >
                  Reset filters
                </div>
              </div>
            </>
          )}
        </div>

        <span className="text-[13px] font-medium text-muted">
          {filterName}
          {cat !== 'all' && ` · ${cat}`} · {list.length}
        </span>
      </div>

      {/* Table panel */}
      <div className="overflow-hidden rounded-card border border-line bg-surface px-[18px] pb-2.5 pt-3.5">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Client', 'Project', 'Service', 'Status', 'Value', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`bg-surface-2 px-3.5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted
                      ${i === 0 ? 'rounded-l-[9px]' : ''} ${i === 5 ? 'rounded-r-[9px]' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p, idx) => {
                const cap = statusCap(p)
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                    className={`group cursor-pointer transition-colors hover:bg-surface-2
                      ${p.status === 'completed' ? 'opacity-50 hover:opacity-90' : ''}`}
                  >
                    <td className={`px-4 py-[17px] text-sm font-semibold text-ink ${idx > 0 ? 'border-t border-line' : ''}`}>
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <span
                          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avTint(p.clientName)}`}
                        >
                          {initials(p.clientName)}
                        </span>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{p.clientName}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-[17px] text-sm text-body ${idx > 0 ? 'border-t border-line' : ''}`}>
                      {p.name}
                    </td>
                    <td className={`px-4 py-[17px] ${idx > 0 ? 'border-t border-line' : ''}`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCat(p.category)
                        }}
                        className="inline-flex h-6 items-center whitespace-nowrap rounded-[20px] border border-line bg-surface-3 px-2.5 text-[11px] font-semibold text-ink-2 transition-colors hover:border-ink hover:bg-surface"
                      >
                        {p.category}
                      </button>
                    </td>
                    <td className={`px-4 py-[17px] ${idx > 0 ? 'border-t border-line' : ''}`}>
                      <span
                        className={`inline-flex h-[25px] items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] text-xs font-semibold ${cap.className}`}
                      >
                        {cap.icon && (
                          <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.2]">
                            {CAP_ICONS[cap.icon]}
                          </svg>
                        )}
                        {cap.label}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-[17px] text-sm font-semibold text-ink [font-variant-numeric:tabular-nums] ${idx > 0 ? 'border-t border-line' : ''}`}
                    >
                      {aed(p.value)}
                    </td>
                    <td className={`px-4 py-[17px] text-right ${idx > 0 ? 'border-t border-line' : ''}`}>
                      <svg
                        viewBox="0 0 24 24"
                        className="ml-auto h-4 w-4 fill-none stroke-faint transition-all duration-150 [stroke-width:2] group-hover:translate-x-1 group-hover:stroke-accent"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-[30px] text-center text-sm text-muted">
                    No projects match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canCreate && (
        <ProjectModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          clientOptions={clientOptions}
          teamOptions={teamOptions}
        />
      )}
    </>
  )
}
