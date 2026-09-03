'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { aed, aedShort, avTint, initials } from '@/lib/demo-format'
import type { ClientDetailDTO, ClientProjectDTO } from '@/lib/services/clients'
import ClientModal from '@/components/client-modal'

const CHIP: Record<ClientDetailDTO['status'], string> = {
  Active: 'text-ok bg-[rgba(30,158,106,.13)]',
  'In pipeline': 'text-[#5a3ec8] bg-[rgba(107,79,230,.13)]',
  Past: 'text-muted bg-surface-3',
  Lead: 'text-[#5f6672] bg-[rgba(174,180,192,.24)]',
}

interface ClientDetailViewProps {
  client: ClientDetailDTO
  canEdit?: boolean
}

export default function ClientDetailView({ client, canEdit = true }: ClientDetailViewProps) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const renderTable = (list: ClientProjectDTO[], title: string) => {
    if (!list.length) return null
    return (
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-bold uppercase tracking-wider text-ink">{title}</h2>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-muted">
            {list.length}
          </span>
        </div>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((p) => (
                <tr
                  key={p.id}
                  className="group transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-3.5 font-semibold text-ink">
                    <Link href={`/dashboard/projects`} className="hover:text-accent">
                      {p.projectName}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block rounded-field bg-surface-3 px-2.5 py-1 text-xs font-medium text-ink-2">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted capitalize">
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-ink [font-variant-numeric:tabular-nums]">
                    {aed(p.value)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-muted group-hover:text-ink">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
            <path d="M15 19l-7-7 7-7" />
          </svg>
          All clients
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          {client.logoUrl ? (
            <img
              src={client.logoUrl}
              alt={client.name}
              className="h-14 w-14 rounded-full border border-line object-cover"
            />
          ) : (
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${avTint(client.name)}`}
            >
              {initials(client.name)}
            </span>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-semibold uppercase leading-tight tracking-tight text-ink">
                {client.name}
              </h1>
              <span className={`rounded-[20px] px-3 py-1 text-xs font-semibold ${CHIP[client.status]}`}>
                {client.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{client.industry} • {client.country}</p>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-field border border-line-2 bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
              <path d="M4 20h4L19 9l-4-4L4 16v4z" />
              <path d="M14 6l4 4" />
            </svg>
            Edit client
          </button>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Industry', client.industry],
          ['Projects', String(client.projectsCount)],
          ['Active', String(client.activeProjectsCount)],
          ['Lifetime value', aedShort(client.totalValue)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card border border-line bg-surface p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-faint">{k}</div>
            <div className="mt-1 text-xl font-bold text-ink [font-variant-numeric:tabular-nums]">{v}</div>
          </div>
        ))}
      </div>

      {client.projects.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-12 text-center text-muted">
          No projects attached to this client yet.
        </div>
      ) : (
        <>
          {renderTable(client.activeProjects, 'Active projects')}
          {renderTable(client.pipelineProjects, 'In pipeline')}
          {renderTable(client.completedProjects, 'Completed')}
          {renderTable(client.lostProjects, 'Not won')}
        </>
      )}

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDeleted={() => router.replace('/dashboard/clients')}
        client={client}
      />
    </>
  )
}
