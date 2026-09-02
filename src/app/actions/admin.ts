'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission, AuthorizationError } from '@/lib/dal'
import { createRole, createRoleSchema, deleteRole, ServiceError } from '@/lib/services/roles'
import { createInvitation, inviteSchema, revokeInvitation } from '@/lib/services/invitations'
import type { FormState } from './auth'

export type InviteState = (FormState & { link?: string; invitedEmail?: string }) | null

function toState(err: unknown): FormState {
  if (err instanceof ServiceError) {
    return err.field ? { fieldErrors: { [err.field]: [err.message] } } : { error: err.message }
  }
  if (err instanceof AuthorizationError) {
    return { error: 'You do not have permission to do that.' }
  }
  console.error('[admin action]', err)
  return { error: 'Something went wrong. Try again.' }
}

export async function createRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requirePermission('role.create')

    const parsed = createRoleSchema.safeParse({
      key: formData.get('key'),
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      // Checkboxes arrive as repeated entries under the same name.
      permissions: formData.getAll('permissions'),
    })

    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

    await createRole(actor, parsed.data)
  } catch (err) {
    return toState(err)
  }

  revalidatePath('/dashboard/roles')
  return { error: undefined }
}

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const actor = await requirePermission('role.delete')
  await deleteRole(actor, String(formData.get('roleId')))
  revalidatePath('/dashboard/roles')
}

export async function inviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  try {
    const actor = await requirePermission('member.invite')

    const parsed = inviteSchema.safeParse({
      email: formData.get('email'),
      roleId: formData.get('roleId'),
    })

    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

    const invitation = await createInvitation(actor, parsed.data)
    revalidatePath('/dashboard/team')

    // Surfaced for copying — there is no email provider wired up yet.
    return { link: invitation.link, invitedEmail: invitation.email }
  } catch (err) {
    return toState(err)
  }
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const actor = await requirePermission('member.invite')
  await revokeInvitation(actor, String(formData.get('invitationId')))
  revalidatePath('/dashboard/team')
}
