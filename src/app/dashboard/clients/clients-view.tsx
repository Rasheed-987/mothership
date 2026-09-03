'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui'
import { aedShort, avTint, initials } from '@/lib/demo-format'
import type { ClientDTO } from '@/lib/services/clients'
import ClientModal from '@/components/client-modal'

const CHIP: Record<ClientDTO['status'], string> = {
  Active: 'text-ok bg-[rgba(30,158,106,.13)]',
  'In pipeline': 'text-[#5a3ec8] bg-[rgba(107,79,230,.13)]',
  Past: 'text-muted bg-surface-3',
  Lead: 'text-[#5f6672] bg-[rgba(174,180,192,.24)]',
}

interface ClientsViewProps {
  clients: ClientDTO[]
  canCreate?: boolean
  canEdit?: boolean
}

export default function ClientsView({ clients, canCreate = true, canEdit = true }: ClientsViewProps) {
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientDTO | null>(null)

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase()),
  )

  const sorted = [...filtered].sort((a, b) => b.activeProjectsCount - a.activeProjectsCount || b.totalValue - a.totalValue)

  function handleAddClient() {
    setEditingClient(null)
    setIsModalOpen(true)
  }

  function handleEditClient(client: ClientDTO, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setEditingClient(client)
    setIsModalOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description="Every client lives here once — name, logo, contact and docs. Project forms only offer clients from this list."
        action={
          canCreate ? (
            <button
              type="button"
              onClick={handleAddClient}
              className="flex shrink-0 items-center gap-2 rounded-field bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-press"
            >
              <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add client
            </button>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or industry…"
            className="w-full rounded-field border border-line-2 bg-surface px-3.5 py-2 pl-9 text-sm text-ink outline-none placeholder:text-faint focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
          />
          <svg viewBox="0 0 24 24" className="absolute left-3 top-2.5 h-4 w-4 fill-none stroke-muted [stroke-width:2]">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="text-xs font-semibold text-muted">
          Showing {sorted.length} of {clients.length} clients
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-12 text-center text-muted">
          No clients found matching &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {sorted.map((client) => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              className="group relative block rounded-card border border-line bg-surface px-5 pb-4 pt-[18px] transition-all duration-150 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md"
            >
              {canEdit && (
                <button
                  type="button"
                  title="Edit client"
                  onClick={(e) => handleEditClient(client, e)}
                  className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 opacity-0 transition-opacity duration-150 hover:bg-surface-3 group-hover:opacity-100"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-muted [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]">
                    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                    <path d="M14 6l4 4" />
                  </svg>
                </button>
              )}

              <div className="mb-4 flex items-center gap-3">
                {client.logoUrl ? (
                  <img
                    src={client.logoUrl}
                    alt={client.name}
                    className="h-10 w-10 shrink-0 rounded-full border border-line object-cover"
                  />
                ) : (
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${avTint(client.name)}`}
                  >
                    {initials(client.name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-ink group-hover:text-accent">
                    {client.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">{client.industry}</div>
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap rounded-[20px] px-2.5 py-[3px] text-[10.5px] font-semibold ${CHIP[client.status]}`}
                >
                  {client.status}
                </span>
              </div>

              <div className="flex gap-[22px] border-t border-line pt-3.5">
                {(
                  [
                    ['Projects', String(client.projectsCount)],
                    ['Active', String(client.activeProjectsCount)],
                    ['Value', aedShort(client.totalValue)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <div className="mb-[5px] text-[10px] font-semibold uppercase tracking-[.05em] text-faint">{k}</div>
                    <div className="text-lg font-semibold text-ink [font-variant-numeric:tabular-nums]">{v}</div>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        client={editingClient}
      />
    </>
  )
}
