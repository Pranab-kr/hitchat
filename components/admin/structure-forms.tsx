'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  createDepartmentForm,
  createYearForm,
  createBatchForm,
  createGroupForm,
  deleteDepartmentForm,
} from '@/app/actions/structure'
import { emptyStructureState } from '@/lib/owner-forms'
import {
  Card,
  Field,
  FormError,
  FormNotice,
  SubmitButton,
} from '@/components/admin/owner-shell'

export type DeptNode = {
  id: string
  name: string
  slug: string
  years: { id: string; number: number; batches: { id: string; number: number; groups: { id: string; label: string }[] }[] }[]
}

// Every form here refreshes the server component on success so the tree below reflects
// what was just created. Structure lives in Postgres and is not in the Realtime
// publication, so nothing pushes these changes on its own.
function useRefreshOnNotice(notice: string | null) {
  const router = useRouter()
  const seen = useRef<string | null>(null)

  useEffect(() => {
    if (notice && notice !== seen.current) {
      seen.current = notice
      router.refresh()
    }
  }, [notice, router])
}

function NewDepartment() {
  const [state, action, pending] = useActionState(createDepartmentForm, emptyStructureState)
  useRefreshOnNotice(state.notice)

  return (
    <Card title="New department">
      <form action={action} className="mt-4 space-y-3">
        <Field id="dept-name" name="name" label="name" placeholder="Computer Science" required />
        <Field
          id="dept-slug"
          name="slug"
          label="short name (used in the URL)"
          placeholder="cse"
          required
        />
        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}
        <SubmitButton pending={pending}>Create department</SubmitButton>
      </form>
    </Card>
  )
}

function AddYear({ departments }: { departments: DeptNode[] }) {
  const [state, action, pending] = useActionState(createYearForm, emptyStructureState)
  useRefreshOnNotice(state.notice)

  if (departments.length === 0) return null

  return (
    <Card title="Add a year">
      <form action={action} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="year-dept"
            className="font-mono text-[12px] leading-4 font-medium tracking-[0.02em] text-graphite"
          >
            department
          </label>
          <select
            id="year-dept"
            name="departmentId"
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
          id="year-number"
          name="number"
          label="year (1–5)"
          type="number"
          min={1}
          max={5}
          defaultValue={1}
          required
        />
        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}
        <SubmitButton pending={pending}>Add year</SubmitButton>
      </form>
    </Card>
  )
}

function AddBatch({ departments }: { departments: DeptNode[] }) {
  const [state, action, pending] = useActionState(createBatchForm, emptyStructureState)
  useRefreshOnNotice(state.notice)

  const years = departments.flatMap((d) =>
    d.years.map((y) => ({ id: y.id, label: `${d.name} · year ${y.number}` })),
  )
  if (years.length === 0) return null

  return (
    <Card title="Add a batch">
      <form action={action} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="batch-year"
            className="font-mono text-[12px] leading-4 font-medium tracking-[0.02em] text-graphite"
          >
            year
          </label>
          <select
            id="batch-year"
            name="yearId"
            required
            className="mt-1 block w-full rounded-input border border-hairline bg-paper px-3 py-2 font-mono text-[13px] leading-[21px] text-ink"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        </div>
        <Field
          id="batch-number"
          name="number"
          label="batch (1–8)"
          type="number"
          min={1}
          max={8}
          defaultValue={1}
          required
        />
        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}
        <SubmitButton pending={pending}>Add batch</SubmitButton>
      </form>
    </Card>
  )
}

function AddGroup({ departments }: { departments: DeptNode[] }) {
  const [state, action, pending] = useActionState(createGroupForm, emptyStructureState)
  useRefreshOnNotice(state.notice)

  const batches = departments.flatMap((d) =>
    d.years.flatMap((y) =>
      y.batches.map((b) => ({
        id: b.id,
        label: `${d.name} · year ${y.number} · batch ${b.number}`,
      })),
    ),
  )
  if (batches.length === 0) return null

  return (
    <Card title="Add a group">
      <form action={action} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="group-batch"
            className="font-mono text-[12px] leading-4 font-medium tracking-[0.02em] text-graphite"
          >
            batch
          </label>
          <select
            id="group-batch"
            name="batchId"
            required
            className="mt-1 block w-full rounded-input border border-hairline bg-paper px-3 py-2 font-mono text-[13px] leading-[21px] text-ink"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <Field id="group-label" name="label" label="group (A–ZZZ)" placeholder="A" required />
        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}
        <SubmitButton pending={pending}>Add group</SubmitButton>
      </form>
    </Card>
  )
}

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

export function StructureForms({ departments }: { departments: DeptNode[] }) {
  return (
    <div className="space-y-6">
      <NewDepartment />
      <AddYear departments={departments} />
      <AddBatch departments={departments} />
      <AddGroup departments={departments} />
      <DeleteDepartment departments={departments} />
    </div>
  )
}
