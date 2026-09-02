import { PageHeader } from '@/components/ui'
import { aedShort, avTint, initials } from '@/lib/demo-format'

/**
 * Clients registry, mirroring the demo's `renderClients()`: page head with
 * subtitle + primary "Add client" action, then a `.clgrid` of `.clcard`s —
 * tinted-initial avatar, name/industry, status chip, hover edit button, and a
 * Projects / Active / Value stats row. Sorted by active count, then value.
 * No hooks — renders on the server; interactivity arrives with the backend.
 */

export type Client = {
  name: string
  industry: string
  projects: number
  active: number
  value: number
  status: 'Active' | 'In pipeline' | 'Past' | 'Lead'
}

// Status chips from the demo (.clstatus.ok/.pl/.neutral/.pd).
const CHIP: Record<Client['status'], string> = {
  Active: 'text-ok bg-[rgba(30,158,106,.13)]',
  'In pipeline': 'text-[#5a3ec8] bg-[rgba(107,79,230,.13)]',
  Past: 'text-muted bg-surface-3',
  Lead: 'text-[#5f6672] bg-[rgba(174,180,192,.24)]',
}

export default function ClientsView({ clients }: { clients: Client[] }) {
  const sorted = [...clients].sort((a, b) => b.active - a.active || b.value - a.value)

  return (
    <>
      <PageHeader
        title="Clients"
        description="Every client lives here once — name, logo, contact and docs. Project forms only offer clients from this list."
        action={
          <button
            type="button"
            disabled
            title="Coming with the backend phase"
            className="flex shrink-0 items-center gap-2 rounded-field bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add client
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {sorted.map((client) => (
          <article
            key={client.name}
            className="group relative cursor-pointer rounded-card border border-line bg-surface px-5 pb-4 pt-[18px]
              transition-all duration-150 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md"
          >
            {/* Hover edit button (.clc-edit) */}
            <button
              type="button"
              title="Edit client"
              disabled
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2
                opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-muted [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]">
                <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                <path d="M14 6l4 4" />
              </svg>
            </button>

            <div className="mb-4 flex items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${avTint(client.name)}`}
              >
                {initials(client.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-ink">{client.name}</div>
                <div className="mt-0.5 text-xs text-muted">{client.industry}</div>
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
                  ['Projects', String(client.projects)],
                  ['Active', String(client.active)],
                  ['Value', aedShort(client.value)],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <div className="mb-[5px] text-[10px] font-semibold uppercase tracking-[.05em] text-faint">{k}</div>
                  <div className="text-lg font-semibold text-ink [font-variant-numeric:tabular-nums]">{v}</div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
