'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission, AuthorizationError } from '@/lib/dal'
import {
  createProject,
  updateProject,
  updateTracker,
  deleteProject,
  projectSchema,
  updateProjectSchema,
  trackerSchema,
  ServiceError,
} from '@/lib/services/projects'
import type { FormState } from './auth'

function toState(err: unknown): FormState {
  if (err instanceof ServiceError) {
    const sErr = err as ServiceError
    return sErr.field ? { fieldErrors: { [sErr.field]: [sErr.message] } } : { error: sErr.message }
  }
  if (err instanceof AuthorizationError) {
    return { error: 'You do not have permission to perform this action.' }
  }
  console.error('[project action error]', err)
  return { error: 'Something went wrong. Try again.' }
}

function safeJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value || '[]'))
  } catch {
    return []
  }
}

/** The core fields, shared by create and update. The modal always submits all of them. */
function coreFields(formData: FormData) {
  return {
    name: formData.get('name'),
    clientId: formData.get('clientId'),
    category: formData.get('category') || 'Creative',
    status: formData.get('status') || 'active',
    health: formData.get('health') || 'on_track',
    daysBehind: formData.get('daysBehind') || 0,
    revisionRounds: formData.get('revisionRounds') || 0,
    plannedDuration: formData.get('plannedDuration') || '',
    progressNote: formData.get('progressNote') || '',
    startDate: formData.get('startDate') || '',
    dueDate: formData.get('dueDate') || '',
    value: formData.get('value') || 0,
    managerId: formData.get('managerId') || '',
    remarks: formData.get('remarks') || '',
    description: formData.get('description') || '',
    clientVisible: formData.get('clientVisible') === 'on',
    resources: safeJson(formData.get('resourcesJson')),
  }
}

export async function createProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requirePermission('project.create')

    const parsed = projectSchema.safeParse(coreFields(formData))
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await createProject(actor, parsed.data)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/projects')
  return { error: undefined }
}

export async function updateProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get('projectId') || '')
  try {
    const actor = await requirePermission('project.update')
    if (!projectId) return { error: 'Project ID is missing.' }

    const parsed = updateProjectSchema.safeParse(coreFields(formData))
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await updateProject(actor, projectId, parsed.data)
    revalidatePath(`/dashboard/projects/${projectId}`)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/projects')
  return { error: undefined }
}

export async function updateTrackerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get('projectId') || '')
  try {
    const actor = await requirePermission('project.update')
    if (!projectId) return { error: 'Project ID is missing.' }

    const parsed = trackerSchema.safeParse({
      progressNote: formData.get('progressNote') || '',
      delayNote: formData.get('delayNote') || '',
      stages: safeJson(formData.get('stagesJson')),
      activity: safeJson(formData.get('activityJson')),
      clientAsks: safeJson(formData.get('clientAsksJson')),
    })
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await updateTracker(actor, projectId, parsed.data)
    revalidatePath(`/dashboard/projects/${projectId}`)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/projects')
  return { error: undefined }
}

export async function deleteProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get('projectId') || '')
  try {
    const actor = await requirePermission('project.delete')
    if (!projectId) return { error: 'Project ID is missing.' }

    await deleteProject(actor, projectId)
    revalidatePath(`/dashboard/projects/${projectId}`)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/projects')
  return { error: undefined }
}
