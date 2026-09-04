'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission, AuthorizationError } from '@/lib/dal'
import { CLIENT_TIERS, type ClientTier } from '@/models/shared'
import {
  createRateCardEntry,
  updateRateCardEntry,
  deleteRateCardEntry,
  rateCardEntrySchema,
  updateRateCardEntrySchema,
  createPricingSheet,
  updatePricingSheet,
  setSheetTier,
  setSubmittedTier,
  pricingSheetSchema,
  ServiceError,
} from '@/lib/services/pricing'
import type { FormState } from './auth'

function toState(err: unknown): FormState {
  if (err instanceof ServiceError) {
    const sErr = err as ServiceError
    return sErr.field ? { fieldErrors: { [sErr.field]: [sErr.message] } } : { error: sErr.message }
  }
  if (err instanceof AuthorizationError) {
    return { error: 'You do not have permission to perform this action.' }
  }
  console.error('[pricing action error]', err)
  return { error: 'Something went wrong. Try again.' }
}

function safeJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value || '[]'))
  } catch {
    return []
  }
}

function asTier(value: FormDataEntryValue | null): ClientTier | null {
  const v = String(value || '')
  return (CLIENT_TIERS as readonly string[]).includes(v) ? (v as ClientTier) : null
}

/* ---- rate card ---- */

function rateFields(formData: FormData) {
  return {
    name: formData.get('name'),
    note: formData.get('note') || '',
    category: formData.get('category') || 'Role',
    hourly: {
      small: formData.get('small') || 0,
      medium: formData.get('medium') || 0,
      large: formData.get('large') || 0,
    },
  }
}

export async function createRateCardEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requirePermission('service.create')
    const parsed = rateCardEntrySchema.safeParse(rateFields(formData))
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
    await createRateCardEntry(actor, parsed.data)
  } catch (err) {
    return toState(err)
  }
  revalidatePath('/dashboard/pricing')
  return { error: undefined }
}

export async function updateRateCardEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requirePermission('service.update')
    const id = String(formData.get('serviceId') || '')
    if (!id) return { error: 'Rate-card entry ID is missing.' }
    const parsed = updateRateCardEntrySchema.safeParse(rateFields(formData))
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
    await updateRateCardEntry(actor, id, parsed.data)
  } catch (err) {
    return toState(err)
  }
  revalidatePath('/dashboard/pricing')
  return { error: undefined }
}

export async function deleteRateCardEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requirePermission('service.delete')
    const id = String(formData.get('serviceId') || '')
    if (!id) return { error: 'Rate-card entry ID is missing.' }
    await deleteRateCardEntry(actor, id)
  } catch (err) {
    return toState(err)
  }
  revalidatePath('/dashboard/pricing')
  return { error: undefined }
}

/* ---- per-project sheet ---- */

export async function createPricingSheetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get('projectId') || '')
  try {
    const actor = await requirePermission('project.update')
    if (!projectId) return { error: 'Project ID is missing.' }
    await createPricingSheet(actor, projectId)
  } catch (err) {
    return toState(err)
  }
  revalidatePath(`/dashboard/pricing/${projectId}`)
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { error: undefined }
}

export async function updatePricingSheetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get('projectId') || '')
  try {
    const actor = await requirePermission('project.update')
    if (!projectId) return { error: 'Project ID is missing.' }

    const parsed = pricingSheetSchema.safeParse({
      tier: asTier(formData.get('tier')) ?? undefined,
      tePct: formData.get('tePct') ?? undefined,
      adminPct: formData.get('adminPct') ?? undefined,
      waitingVendor: formData.get('waitingVendor') === 'on',
      phases: safeJson(formData.get('phasesJson')),
      thirdParty: safeJson(formData.get('thirdPartyJson')),
    })
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
    await updatePricingSheet(actor, projectId, parsed.data)
  } catch (err) {
    return toState(err)
  }
  revalidatePath(`/dashboard/pricing/${projectId}`)
  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/pricing')
  return { error: undefined }
}

export async function setSheetTierAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get('projectId') || '')
  try {
    const actor = await requirePermission('project.update')
    const tier = asTier(formData.get('tier'))
    if (!projectId || !tier) return { error: 'Missing project or tier.' }
    await setSheetTier(actor, projectId, tier)
  } catch (err) {
    return toState(err)
  }
  revalidatePath(`/dashboard/pricing/${projectId}`)
  return { error: undefined }
}

export async function setSubmittedTierAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get('projectId') || '')
  try {
    const actor = await requirePermission('project.update')
    const tier = asTier(formData.get('tier'))
    if (!projectId || !tier) return { error: 'Missing project or tier.' }
    await setSubmittedTier(actor, projectId, tier)
  } catch (err) {
    return toState(err)
  }
  revalidatePath(`/dashboard/pricing/${projectId}`)
  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/pricing')
  return { error: undefined }
}
