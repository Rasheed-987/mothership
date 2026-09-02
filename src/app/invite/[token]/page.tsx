import type { Metadata } from 'next'
import Link from 'next/link'
import { inspectInvitation } from '@/lib/services/invitations'
import { Alert } from '@/components/ui'
import { AcceptForm } from './accept-form'

export const metadata: Metadata = { title: 'Accept invitation · Mothership' }

const REASONS = {
  invalid: 'This invitation link is not valid. Check you copied the whole link, or ask for a new one.',
  expired: 'This invitation has expired. Ask your administrator to send a new one.',
  revoked: 'This invitation was revoked.',
  accepted: 'This invitation has already been used. Try signing in instead.',
} as const

export default async function AcceptInvitePage({ params }: { params: { token: string } }) {
  const { token } = params
  // Read-only: nothing is committed until the form is submitted.
  const invitation = await inspectInvitation(decodeURIComponent(token))

  if (!invitation.ok) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Invitation unavailable</h1>
          <Alert>{REASONS[invitation.reason]}</Alert>
          <Link href="/login" className="inline-block text-sm underline underline-offset-4">
            Go to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">You&rsquo;ve been invited</h1>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Set a password for <strong className="font-medium text-black dark:text-white">{invitation.email}</strong> to
            join as <strong className="font-medium text-black dark:text-white">{invitation.roleName}</strong>.
          </p>
        </div>

        <AcceptForm token={decodeURIComponent(token)} />

        <p className="mt-6 text-xs text-black/45 dark:text-white/45">
          This link expires {invitation.expiresAt.toLocaleDateString()} and can only be used once.
        </p>
      </div>
    </main>
  )
}
