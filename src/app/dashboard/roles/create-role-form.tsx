'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { createRoleAction } from '@/app/actions/admin'
import { PERMISSION_GROUPS, PERMISSIONS } from '@/lib/permissions'
import { Alert, Button, Card, FieldError, Input, Label } from '@/components/ui'
import { SubmitButton } from '@/components/submit-button'

/**
 * The role builder. It is nothing more than checkboxes over the permission
 * catalog — ticking boxes writes the strings into `role.permissions[]`.
 */
export function CreateRoleForm({ grantable }: { grantable: string[] }) {
  const [state, action] = useFormState(createRoleAction, null)
  const [open, setOpen] = useState(false)
  const allowed = new Set(grantable)

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="ghost">
        New role
      </Button>
    )
  }

  return (
    <Card className="mb-8">
      <form action={action} className="space-y-5">
        {state?.error && <Alert>{state.error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input id="name" name="name" placeholder="Junior Designer" required />
            <FieldError errors={state?.fieldErrors?.name} />
          </div>
          <div>
            <Label htmlFor="key">Key</Label>
            <Input id="key" name="key" placeholder="junior_designer" pattern="[a-z][a-z0-9_]*" required />
            <FieldError errors={state?.fieldErrors?.key} />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" placeholder="What this role is for" />
        </div>

        <div>
          <Label>Permissions</Label>
          <FieldError errors={state?.fieldErrors?.permissions} />
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {PERMISSION_GROUPS.map((group) => (
              <fieldset key={group.key} className="rounded-md border border-black/10 p-3 dark:border-white/10">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                  {group.label}
                </legend>
                <div className="space-y-1.5">
                  {group.permissions.map((permission) => {
                    const disabled = !allowed.has(permission)
                    return (
                      <label
                        key={permission}
                        className={`flex items-start gap-2 text-xs ${disabled ? 'opacity-40' : 'cursor-pointer'}`}
                        title={disabled ? 'You cannot grant a permission you do not hold' : PERMISSIONS[permission]}
                      >
                        <input
                          type="checkbox"
                          name="permissions"
                          value={permission}
                          disabled={disabled}
                          className="mt-0.5"
                        />
                        <span className="font-mono">{permission}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <SubmitButton idle="Create role" busy="Creating…" />
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}
