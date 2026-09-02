'use client'

import { useFormState } from 'react-dom'
import { acceptInvite } from '@/app/actions/auth'
import { Alert, FieldError, Input, Label } from '@/components/ui'
import { SubmitButton } from '@/components/submit-button'

export function AcceptForm({ token }: { token: string }) {
  const [state, action] = useFormState(acceptInvite, null)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state?.error && <Alert>{state.error}</Alert>}

      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required autoFocus />
        <FieldError errors={state?.fieldErrors?.name} />
      </div>

      <div>
        <Label htmlFor="password">Choose a password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        <FieldError errors={state?.fieldErrors?.password} />
        <p className="mt-1.5 text-xs text-black/45 dark:text-white/45">
          At least 10 characters, including a letter and a number.
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        <FieldError errors={state?.fieldErrors?.confirmPassword} />
      </div>

      <SubmitButton idle="Create account" busy="Creating your account…" className="w-full" />
    </form>
  )
}
