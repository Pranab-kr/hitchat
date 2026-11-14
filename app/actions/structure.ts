'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/lib/auth/require'
import { creatorIdentity } from '@/lib/guards'
import { type ActionResult, ok, err } from '@/lib/result'
import { type StructureState, toStructureState } from '@/lib/owner-forms'

// Guards come from @/lib/auth/require, never from @/app/actions/admin: every export of
// a 'use server' file is a callable HTTP endpoint.
//
// Creation is open: an anonymous student can build the whole department → year → batch
// → room chain from the picker, and pays for each write out of a shared hourly bucket
// (creatorIdentity in lib/guards.ts). Deletion is not — removing a department cascades
// every room under it, so it stays with the owner and nobody else.

const SLUG = /^[a-z0-9-]{2,20}$/

// Reserved because /c/[dept]/... and /sudo/... share the root path space. A department
// slugged "sudo" would not break routing today, but it makes for links that read as
// admin URLs, and "c" would be actively confusing.
const RESERVED_SLUGS = new Set(['c', 'sudo', 'api', 'about', 'new', 'admin'])

export async function createDepartment(input: {
  name: string
  slug: string
  token?: string
}): Promise<ActionResult<{ id: string }>> {
  const name = input.name.trim()
  if (!name) return err('invalid', 'Give the department a name.')
  if (name.length > 60) return err('invalid', 'That name is too long. Keep it under 60 characters.')

  const slug = input.slug.trim().toLowerCase()
  if (!SLUG.test(slug)) {
    return err('invalid', 'The short name can use lowercase letters, numbers and dashes only.')
  }
  if (RESERVED_SLUGS.has(slug)) return err('invalid', 'That short name is reserved.')

  const creator = await creatorIdentity(input.token)
  if (!creator.ok) return creator

  const db = getServiceClient()
  const { data, error } = await db
    .from('departments')
    .insert({ name, slug })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That short name is already taken.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function createYear(input: {
  departmentId: string
  number: number
  token?: string
}): Promise<ActionResult<{ id: string }>> {
  // 5 is allowed for five-year integrated courses; the DB check constraint matches.
  if (!Number.isInteger(input.number) || input.number < 1 || input.number > 5) {
    return err('invalid', 'Year must be between 1 and 5.')
  }

  const creator = await creatorIdentity(input.token)
  if (!creator.ok) return creator

  const db = getServiceClient()
  const { data, error } = await db
    .from('years')
    .insert({ department_id: input.departmentId, number: input.number })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That year already exists.')
  // A bad departmentId is a foreign key violation, not a server fault. Reporting it as
  // 'server' would tell the owner to "try again" at something that can never succeed.
  if (error?.code === '23503') return err('invalid', 'That department no longer exists.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function createBatch(input: {
  yearId: string
  number: number
  token?: string
}): Promise<ActionResult<{ id: string }>> {
  if (!Number.isInteger(input.number) || input.number < 1 || input.number > 8) {
    return err('invalid', 'Batch number must be between 1 and 8.')
  }

  const creator = await creatorIdentity(input.token)
  if (!creator.ok) return creator

  const db = getServiceClient()
  const { data, error } = await db
    .from('batches')
    .insert({ year_id: input.yearId, number: input.number })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That batch already exists.')
  if (error?.code === '23503') return err('invalid', 'That year no longer exists.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function deleteDepartment(input: {
  id: string
  confirmName: string
}): Promise<ActionResult<null>> {
  // Owner-only. A department delete cascades every room beneath it, so letting a
  // co-admin through here would hand them a way around the rule that they may only
  // remove rooms they created.
  const auth = await requireOwner()
  if (!auth.ok) return auth

  const db = getServiceClient()
  const { data: dept } = await db
    .from('departments')
    .select('name')
    .eq('id', input.id)
    .maybeSingle()

  if (!dept) return err('invalid', 'That department is already gone.')

  // Typed confirmation — this cascades to every year, batch, group and message beneath
  // it. Compared trimmed but case-sensitively: this is the last thing standing between
  // a misclick and every room in a department.
  if (dept.name !== input.confirmName.trim()) {
    return err('invalid', `Type "${dept.name}" exactly to delete it.`)
  }

  const { error } = await db.from('departments').delete().eq('id', input.id)
  if (error) return err('server', "Couldn't delete that. Try again.")
  return ok(null)
}

// ── Form-action wrappers ────────────────────────────────────────────────────────
// Same pattern as loginFormAction: a form posting to one of these works with
// JavaScript disabled, which a client-side onSubmit handler cannot.
//
// StructureState and emptyStructureState live in lib/owner-forms.ts — a 'use server'
// file may only export async functions, so a plain object exported from here throws at
// import time and 500s every form on the page.

const text = (form: FormData, key: string): string => {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

function toState(result: ActionResult<unknown>, notice: string): StructureState {
  return toStructureState(result, notice)
}

export async function createDepartmentForm(
  _prev: StructureState,
  form: FormData,
): Promise<StructureState> {
  const name = text(form, 'name')
  const result = await createDepartment({
    name,
    slug: text(form, 'slug'),
    token: text(form, 'token'),
  })
  return toState(result, `Created ${name.trim()}.`)
}

export async function createYearForm(
  _prev: StructureState,
  form: FormData,
): Promise<StructureState> {
  const number = Number(text(form, 'number'))
  const result = await createYear({
    departmentId: text(form, 'departmentId'),
    number,
    token: text(form, 'token'),
  })
  return toState(result, `Added year ${number}.`)
}

export async function createBatchForm(
  _prev: StructureState,
  form: FormData,
): Promise<StructureState> {
  const number = Number(text(form, 'number'))
  const result = await createBatch({
    yearId: text(form, 'yearId'),
    number,
    token: text(form, 'token'),
  })
  return toState(result, `Added batch ${number}.`)
}

export async function deleteDepartmentForm(
  _prev: StructureState,
  form: FormData,
): Promise<StructureState> {
  const result = await deleteDepartment({
    id: text(form, 'id'),
    confirmName: text(form, 'confirmName'),
  })
  return toState(result, 'Department deleted.')
}
