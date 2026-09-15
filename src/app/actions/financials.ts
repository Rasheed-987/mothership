'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/dal'
import {
  createVendorPaymentAction,
  updateVendorPaymentAction,
  deleteVendorPaymentAction,
  createReconTransactionAction,
  deleteReconTransactionAction,
  createCompletedProjectAction,
  deleteCompletedProjectAction,
} from '@/lib/services/financials'
import type { FormState } from './auth'

export async function createVendorPaymentFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await getCurrentUser()
    if (!actor) return { error: 'Unauthorized' }

    const vendorName = String(formData.get('vendorName') || '')
    const clientName = String(formData.get('clientName') || '')
    const projectName = String(formData.get('projectName') || '')
    const cost = Number(formData.get('cost') || 0)
    const paid = Number(formData.get('paid') || 0)

    if (!vendorName) return { error: 'Vendor name is required' }

    await createVendorPaymentAction(actor, { vendorName, clientName, projectName, cost, paid })
  } catch (err: any) {
    return { error: err?.message || 'Failed to create vendor payment' }
  }

  revalidatePath('/dashboard/financials')
  return { error: undefined }
}

export async function updateVendorPaymentFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await getCurrentUser()
    if (!actor) return { error: 'Unauthorized' }

    const id = String(formData.get('id') || '')
    const vendorName = String(formData.get('vendorName') || '')
    const clientName = String(formData.get('clientName') || '')
    const projectName = String(formData.get('projectName') || '')
    const cost = Number(formData.get('cost') || 0)
    const paid = Number(formData.get('paid') || 0)

    if (!id || !vendorName) return { error: 'Invalid form submission' }

    await updateVendorPaymentAction(actor, id, { vendorName, clientName, projectName, cost, paid })
  } catch (err: any) {
    return { error: err?.message || 'Failed to update vendor payment' }
  }

  revalidatePath('/dashboard/financials')
  return { error: undefined }
}

export async function deleteVendorPaymentFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await getCurrentUser()
    if (!actor) return { error: 'Unauthorized' }

    const id = String(formData.get('id') || '')
    if (!id) return { error: 'Missing ID' }

    await deleteVendorPaymentAction(actor, id)
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete vendor payment' }
  }

  revalidatePath('/dashboard/financials')
  return { error: undefined }
}

export async function createReconTransactionFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await getCurrentUser()
    if (!actor) return { error: 'Unauthorized' }

    const date = String(formData.get('date') || new Date().toISOString().slice(0, 10))
    const clientName = String(formData.get('clientName') || '')
    const projectName = String(formData.get('projectName') || '')
    const invoiceNumber = String(formData.get('invoiceNumber') || '')
    const amount = Number(formData.get('amount') || 0)
    const notes = String(formData.get('notes') || '')

    if (!clientName) return { error: 'Client name is required' }

    await createReconTransactionAction(actor, { date, clientName, projectName, invoiceNumber, amount, notes })
  } catch (err: any) {
    return { error: err?.message || 'Failed to add transaction' }
  }

  revalidatePath('/dashboard/financials')
  return { error: undefined }
}

export async function deleteReconTransactionFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await getCurrentUser()
    if (!actor) return { error: 'Unauthorized' }

    const id = String(formData.get('id') || '')
    if (!id) return { error: 'Missing ID' }

    await deleteReconTransactionAction(actor, id)
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete transaction' }
  }

  revalidatePath('/dashboard/financials')
  return { error: undefined }
}

export async function createCompletedProjectFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await getCurrentUser()
    if (!actor) return { error: 'Unauthorized' }

    const project = String(formData.get('project') || '')
    const clientName = String(formData.get('clientName') || '')
    const invoiceNumber = String(formData.get('invoiceNumber') || '')
    const date = String(formData.get('date') || new Date().toISOString().slice(0, 10))
    const value = Number(formData.get('value') || 0)

    if (!project) return { error: 'Project name is required' }

    await createCompletedProjectAction(actor, { project, clientName, invoiceNumber, date, value })
  } catch (err: any) {
    return { error: err?.message || 'Failed to add project' }
  }

  revalidatePath('/dashboard/financials')
  return { error: undefined }
}

export async function deleteCompletedProjectFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await getCurrentUser()
    if (!actor) return { error: 'Unauthorized' }

    const id = String(formData.get('id') || '')
    if (!id) return { error: 'Missing ID' }

    await deleteCompletedProjectAction(actor, id)
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete project' }
  }

  revalidatePath('/dashboard/financials')
  return { error: undefined }
}
