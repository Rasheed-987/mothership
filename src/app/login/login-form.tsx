'use client'

import { useFormState } from 'react-dom'
import { login } from '@/app/actions/auth'
import { Alert, FieldError, Input, Label } from '@/components/ui'
import { SubmitButton } from '@/components/submit-button'

export function LoginForm() {
  const [state, action] = useFormState(login, null)

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        <FieldError errors={state?.fieldErrors?.email} />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
        <FieldError errors={state?.fieldErrors?.password} />
      </div>

      <SubmitButton idle="Sign in" busy="Signing in…" className="w-full" />
    </form>
  )
}
