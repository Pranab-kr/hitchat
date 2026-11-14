'use client'

import { useActionState } from 'react'
import { createRoomForm } from '@/app/actions/rooms'
import { emptyStructureState } from '@/lib/owner-forms'
import { useAnonToken } from '@/lib/use-anon-token'
import { useRefreshOnNotice } from '@/lib/use-refresh-on-notice'
import { Card, Field, FormError, FormNotice, SubmitButton } from '@/components/admin/owner-shell'

function TokenField({ token }: { token: string | null }) {
  return <input type="hidden" name="token" value={token ?? ''} />
}

export function CreateForms() {
  const { token } = useAnonToken()
  const [state, action, pending] = useActionState(createRoomForm, emptyStructureState)
  useRefreshOnNotice(state.notice)

  return (
    <Card title="New room">
      <form action={action} className="mt-4 space-y-4">
        <TokenField token={token} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="room-department"
            name="department"
            label="department"
            placeholder="Computer Science"
            autoComplete="off"
            required
          />
          <Field
            id="room-year"
            name="year"
            label="year (1–5)"
            type="number"
            min={1}
            max={5}
            placeholder="3"
            required
          />
          <Field
            id="room-batch"
            name="batch"
            label="batch (1–8)"
            type="number"
            min={1}
            max={8}
            placeholder="2"
            required
          />
          <Field
            id="room-label"
            name="label"
            label="group"
            placeholder="A"
            autoComplete="off"
            required
          />
        </div>
        <p className="font-mono text-[12px] leading-4 text-graphite">
          Type the department, year, batch and group. Existing structure is reused automatically.
        </p>
        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}
        <SubmitButton pending={pending}>Create room</SubmitButton>
      </form>
    </Card>
  )
}
