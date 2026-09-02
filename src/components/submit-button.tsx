'use client'

import { useFormStatus } from 'react-dom'
import { Button } from './ui'

/**
 * React 18's `useFormState` returns only [state, action] — no pending flag.
 * (React 19's `useActionState` returns it as a third element.)
 *
 * The replacement is `useFormStatus`, which only works from a component nested
 * *inside* the <form>, so the button has to be its own component rather than
 * inline JSX.
 */
export function SubmitButton({
  idle,
  busy,
  className,
  variant = 'primary',
}: {
  idle: string
  busy: string
  className?: string
  variant?: 'primary' | 'ghost' | 'danger'
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className={className} variant={variant}>
      {pending ? busy : idle}
    </Button>
  )
}
