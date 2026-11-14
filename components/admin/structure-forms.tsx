'use client'

import { useActionState } from 'react'
import { deleteDepartmentForm } from '@/app/actions/structure'
import { emptyStructureState } from '@/lib/owner-forms'
import { useRefreshOnNotice } from '@/lib/use-refresh-on-notice'
import { CreateForms } from '@/components/room/create-forms'
import {
  Card,
  Field,
  FormError,
  FormNotice,
  SubmitButton,
} from '@/components/admin/owner-shell'

type DeptNode = {
  id: string
  name: string
  slug: string
  years: {
    id: string
    number: number
    batches: { id: string; number: number; groups: { id: string; label: string }[] }[]
  }[]
}

// The creation forms moved to components/room/create-forms.tsx when they became public:
// the picker at `/` and this page now render the same components. What stays here is the
// one structure operation that is still owner-only.

function DeleteDepartment({ departments }: { departments: DeptNode[] }) {
  const [state, action, pending] = useActionState(deleteDepartmentForm, emptyStructureState)
  useRefreshOnNotice(state.notice)

  if (departments.length === 0) return null

  return (
    <Card title="Delete a department">
      <p className="mt-1 text-[15px] leading-6 text-graphite">
        This removes every year, batch, group and message beneath it. There is no undo.
      </p>
      <form action={action} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="del-dept"
            className="font-mono text-[12px] leading-4 font-medium tracking-[0.02em] text-graphite"
          >
            department
          </label>
          <select
            id="del-dept"
            name="id"
            required
            className="mt-1 block w-full rounded-input border border-hairline bg-paper px-3 py-2 font-mono text-[13px] leading-[21px] text-ink"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <Field
          id="del-confirm"
          name="confirmName"
          label="type the department name exactly"
          autoComplete="off"
          required
        />
        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}
        <SubmitButton pending={pending} variant="destructive">
          Delete department
        </SubmitButton>
      </form>
    </Card>
  )
}

export function StructureForms({
  departments,
  canDelete,
}: {
  departments: DeptNode[]
  canDelete: boolean
}) {
  return (
    <div className="space-y-6">
      <CreateForms />
      {canDelete && <DeleteDepartment departments={departments} />}
    </div>
  )
}
