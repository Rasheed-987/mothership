'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission, AuthorizationError } from '@/lib/dal'
import {
  createDeal,
  updateDeal,
  addDealNote,
  deleteDeal,
  dealSchema,
  updateDealSchema,
  noteSchema,
  ServiceError,
} from '@/lib/services/deals'
import type { FormState } from './auth'

function toState(err: unknown): FormState {
  if (err instanceof ServiceError) {
    const sErr = err as ServiceError
    return sErr.field ? { fieldErrors: { [sErr.field]: [sErr.message] } } : { error: sErr.message }
  }
  if (err instanceof AuthorizationError) {
    return { error: 'You do not have permission to perform this action.' }
  }
  console.error('[deal action error]', err)
  return { error: 'Something went wrong. Try again.' }
}

function coreFields(formData: FormData) {
  return {
    title: formData.get('title'),
    clientId: formData.get('clientId'),
    category: formData.get('category') || 'Creative',
    stage: formData.get('stage') || 'lead',
    confidence: formData.get('confidence') || 'high',
    value: formData.get('value') || 0,
    probability: formData.get('probability') === '' ? undefined : formData.get('probability'),
    expectedCloseDate: formData.get('expectedCloseDate') || '',
    nextFollowUpDate: formData.get('nextFollowUpDate') || '',
    ownerId: formData.get('ownerId') || '',
    source: formData.get('source') || '',
  }
}

export async function createDealAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requirePermission('deal.create')

    const parsed = dealSchema.safeParse(coreFields(formData))
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await createDeal(actor, parsed.data)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/pipeline')
  return { error: undefined }
}

export async function updateDealAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const dealId = String(formData.get('dealId') || '')
  try {
    const actor = await requirePermission('deal.update')
    if (!dealId) return { error: 'Deal ID is missing.' }

    const parsed = updateDealSchema.safeParse(coreFields(formData))
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await updateDeal(actor, dealId, parsed.data)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/pipeline')
  return { error: undefined }
}

export async function addDealNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const dealId = String(formData.get('dealId') || '')
  try {
    const actor = await requirePermission('deal.update')
    if (!dealId) return { error: 'Deal ID is missing.' }

    const parsed = noteSchema.safeParse({ text: formData.get('text') || '' })
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await addDealNote(actor, dealId, parsed.data)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/pipeline')
  return { error: undefined }
}

export async function deleteDealAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const dealId = String(formData.get('dealId') || '')
  try {
    const actor = await requirePermission('deal.delete')
    if (!dealId) return { error: 'Deal ID is missing.' }

    await deleteDeal(actor, dealId)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/pipeline')
  return { error: undefined }
}
