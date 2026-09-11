'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require'
import { type ActionResult, ok, err } from '@/lib/result'
import type { StructureState } from '@/lib/owner-forms'

// Guards come from @/lib/auth/require, never from @/app/actions/admin: every export of
// a 'use server' file is a callable HTTP endpoint.

const SLUG = /^[a-z0-9-]{2,20}$/

// Reserved because /c/[dept]/... and /sudo/... share the root path space. A department
// slugged "sudo" would not break routing today, but it makes for links that read as
// admin URLs, and "c" would be actively confusing.
const RESERVED_SLUGS = new Set(['c', 'sudo', 'api', 'about', 'new', 'admin'])

export async function createDepartment(input: {
  name: string
  slug: string
}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const name = input.name.trim()
  if (!name) return err('invalid', 'Give the department a name.')
  if (name.length > 60) return err('invalid', 'That name is too long. Keep it under 60 characters.')

  const slug = input.slug.trim().toLowerCase()
  if (!SLUG.test(slug)) {
    return err('invalid', 'The short name can use lowercase letters, numbers and dashes only.')
  }
  if (RESERVED_SLUGS.has(slug)) return err('invalid', 'That short name is reserved.')

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
}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  // 5 is allowed for five-year integrated courses; the DB check constraint matches.
  if (!Number.isInteger(input.number) || input.number < 1 || input.number > 5) {
    return err('invalid', 'Year must be between 1 and 5.')
  }

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
}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  if (!Number.isInteger(input.number) || input.number < 1 || input.number > 8) {
    return err('invalid', 'Batch number must be between 1 and 8.')
  }

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

export async function createGroup(input: {
  batchId: string
  label: string
}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  // Stored uppercase, and the room URL lowercases it. The room page looks the group up
  // with .eq('label', group.toUpperCase()), so a lowercase row would be unreachable.
  const label = input.label.trim().toUpperCase()
  if (!/^[A-Z]{1,3}$/.test(label)) {
    return err('invalid', 'Group label is 1 to 3 letters, like A or B.')
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from('groups')
    .insert({ batch_id: input.batchId, label })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That group already exists.')
  if (error?.code === '23503') return err('invalid', 'That batch no longer exists.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function deleteDepartment(input: {
  id: string
  confirmName: string
}): Promise<ActionResult<null>> {
  const auth = await requireAdmin()
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
  if (!result.ok) return { error: result.message, notice: null }
  return { error: null, notice }
}

export async function createDepartmentForm(
  _prev: StructureState,
  form: FormData,
): Promise<StructureState> {
  const name = text(form, 'name')
  const result = await createDepartment({ name, slug: text(form, 'slug') })
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
  })
  return toState(result, `Added year ${number}.`)
}

export async function createBatchForm(
  _prev: StructureState,
  form: FormData,
): Promise<StructureState> {
  const number = Number(text(form, 'number'))
  const result = await createBatch({ yearId: text(form, 'yearId'), number })
  return toState(result, `Added batch ${number}.`)
}

export async function createGroupForm(
  _prev: StructureState,
  form: FormData,
): Promise<StructureState> {
  const label = text(form, 'label').trim().toUpperCase()
  const result = await createGroup({ batchId: text(form, 'batchId'), label })
  return toState(result, `Added group ${label}.`)
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
