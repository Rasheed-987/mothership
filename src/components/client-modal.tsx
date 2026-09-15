'use client'

import { useState, useTransition, useEffect, type ChangeEvent } from 'react'
import type { ClientDTO } from '@/lib/services/clients'
import { createClientAction, updateClientAction, deleteClientAction } from '@/app/actions/clients'
import { FieldError, Alert } from '@/components/ui'

interface ClientModalProps {
  isOpen: boolean
  onClose: () => void
  client?: ClientDTO | null
  /** Called after a successful delete; defaults to onClose. */
  onDeleted?: () => void
}

export default function ClientModal({ isOpen, onClose, client, onDeleted }: ClientModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>()
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const isEditing = Boolean(client)

  useEffect(() => {
    if (client?.logoUrl) {
      setLogoPreview(client.logoUrl)
    } else {
      setLogoPreview(null)
    }
    setError(null)
    setFieldErrors(undefined)
  }, [client, isOpen])

  if (!isOpen) return null

  function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        setLogoPreview(String(event.target.result))
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(formData: FormData) {
    if (logoPreview) {
      formData.set('logoUrl', logoPreview)
    }

    setError(null)
    setFieldErrors(undefined)

    startTransition(async () => {
      const res = isEditing
        ? await updateClientAction(null, formData)
        : await createClientAction(null, formData)

      if (res?.error) {
        setError(res.error)
      } else if (res?.fieldErrors) {
        setFieldErrors(res.fieldErrors)
      } else {
        onClose()
      }
    })
  }

  async function handleDelete() {
    if (!client) return
    if (!confirm(`Remove ${client.name} from the client list?`)) return

    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('clientId', client.id)
      const res = await deleteClientAction(null, formData)
      if (res?.error) {
        setError(res.error)
      } else {
        ;(onDeleted ?? onClose)()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-card border border-line-2 bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-ink">
            {isEditing ? 'Edit client' : 'Add client'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current fill-none [stroke-width:2]">
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
          {isEditing && <input type="hidden" name="clientId" value={client?.id} />}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Client name</label>
            <input
              name="name"
              required
              defaultValue={client?.name || ''}
              placeholder="Client name"
              className="w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <FieldError errors={fieldErrors?.name} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Logo</label>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line-2 bg-surface-2 text-muted">
                {logoPreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full rounded-lg object-contain p-1" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current [stroke-width:2]">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-3">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current [stroke-width:2]">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Upload image
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Industry</label>
              <input
                name="industry"
                defaultValue={client?.industry || ''}
                placeholder="Healthcare"
                className="w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              <FieldError errors={fieldErrors?.industry} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Country</label>
              <input
                name="country"
                defaultValue={client?.country || 'UAE'}
                placeholder="UAE"
                className="w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Contact person</label>
            <input
              name="contactName"
              defaultValue={client?.contactName || ''}
              placeholder="Full name"
              className="w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Contact email</label>
              <input
                name="contactEmail"
                type="email"
                defaultValue={client?.contactEmail || ''}
                placeholder="name@client.com"
                className="w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              <FieldError errors={fieldErrors?.contactEmail} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Contact phone</label>
              <input
                name="contactPhone"
                defaultValue={client?.contactPhone || ''}
                placeholder="+971 5X XXX XXXX"
                className="w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Docs folder (Drive)</label>
            <input
              name="docs"
              defaultValue={client?.docs || ''}
              placeholder="https://drive.google.com/…"
              className="w-full rounded-field border border-line-2 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
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
                Remove this client
              </button>
            ) : <div />}

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
                className="flex items-center gap-2 rounded-field bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-press disabled:opacity-50"
              >
                {isPending ? 'Saving…' : isEditing ? 'Save client' : 'Add client'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
