'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { inviteAction } from '@/app/actions/admin'
import { Alert, Button, Card, FieldError, Input, Label, Select } from '@/components/ui'
import { SubmitButton } from '@/components/submit-button'

type RoleOption = { id: string; name: string }

export function InviteForm({ roles }: { roles: RoleOption[] }) {
  const [state, action] = useFormState(inviteAction, null)
  const [copied, setCopied] = useState(false)

  async function copy(link: string) {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="mb-8">
      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="person@company.com" required />
            <FieldError errors={state?.fieldErrors?.email} />
          </div>

          <div className="sm:w-52">
            <Label htmlFor="roleId">Role</Label>
            <Select id="roleId" name="roleId" required defaultValue="">
              <option value="" disabled>
                Choose a role…
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
            <FieldError errors={state?.fieldErrors?.roleId} />
          </div>

          <SubmitButton idle="Create invite" busy="Creating…" />
        </div>

        {state?.error && <Alert>{state.error}</Alert>}

        {state?.link && (
          <Alert tone="success">
            <p className="mb-2 font-medium">Invite created for {state.invitedEmail}</p>
            <p className="mb-2 text-xs">
              Send this link to them. It works once, expires in 7 days, and{' '}
              <strong>this is the only time it will be shown</strong> — only its hash is stored.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-black/10 px-2 py-1.5 font-mono text-[11px] dark:bg-black/40">
                {state.link}
              </code>
              <Button type="button" variant="ghost" onClick={() => copy(state.link!)}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </Alert>
        )}
      </form>
    </Card>
  )
}
