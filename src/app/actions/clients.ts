'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission, AuthorizationError } from '@/lib/dal'
import { createClient, updateClient, deleteClient, clientSchema, ServiceError } from '@/lib/services/clients'
import type { FormState } from './auth'

function toState(err: unknown): FormState {
  if (err instanceof ServiceError) {
    const sErr = err as ServiceError
    return sErr.field ? { fieldErrors: { [sErr.field]: [sErr.message] } } : { error: sErr.message }
  }
  if (err instanceof AuthorizationError) {
    return { error: 'You do not have permission to perform this action.' }
  }
  console.error('[client action error]', err)
  return { error: 'Something went wrong. Try again.' }
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requirePermission('client.create')

    const parsed = clientSchema.safeParse({
      name: formData.get('name'),
      industry: formData.get('industry') || '—',
      country: formData.get('country') || 'UAE',
      contactName: formData.get('contactName') || '',
      contactEmail: formData.get('contactEmail') || '',
      contactPhone: formData.get('contactPhone') || '',
      docs: formData.get('docs') || '',
      logoUrl: formData.get('logoUrl') || '',
    })

    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await createClient(actor, parsed.data)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/clients')
  return { error: undefined }
}

export async function updateClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requirePermission('client.update')
    const clientId = String(formData.get('clientId'))

    if (!clientId) return { error: 'Client ID is missing.' }

    const parsed = clientSchema.safeParse({
      name: formData.get('name'),
      industry: formData.get('industry') || '—',
      country: formData.get('country') || 'UAE',
      contactName: formData.get('contactName') || '',
      contactEmail: formData.get('contactEmail') || '',
      contactPhone: formData.get('contactPhone') || '',
      docs: formData.get('docs') || '',
      logoUrl: formData.get('logoUrl') || '',
    })

    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await updateClient(actor, clientId, parsed.data)
    revalidatePath(`/dashboard/clients/${clientId}`)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/clients')
  return { error: undefined }
}

export async function deleteClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requirePermission('client.delete')
    const clientId = String(formData.get('clientId'))

    if (!clientId) return { error: 'Client ID is missing.' }

    await deleteClient(actor, clientId)
    revalidatePath(`/dashboard/clients/${clientId}`)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/clients')
  return { error: undefined }
}
