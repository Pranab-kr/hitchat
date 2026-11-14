'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { currentAdmin } from '@/lib/auth/current-admin'
import { creatorIdentity } from '@/lib/guards'
import { hashToken } from '@/lib/identity'
import { type ActionResult, ok, err } from '@/lib/result'
import { type StructureState, toStructureState } from '@/lib/owner-forms'

// A room IS a group. Creation is open to anyone — an anonymous student, a co-admin and
// the owner all reach the same action — while deletion follows creator ownership:
//
//   owner     → any room
//   co-admin  → only a room they created
//   student   → only a room they created
//
// Both facts are derived server-side. A client only ever receives the booleans that
// decide which controls to render; it never sees the hash that proves ownership.

const LABEL = /^[A-Z]{1,3}$/
const DEPARTMENT_NAME = /^[A-Za-z0-9][A-Za-z0-9 -]*$/
const SLUG = /^[a-z0-9-]{2,20}$/
const RESERVED_SLUGS = new Set(['c', 'sudo', 'api', 'about', 'new', 'admin'])

type RoomInput = {
  department: string
  year: number
  batch: number
  label: string
  token?: string
}

function departmentSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

async function findOrCreateDepartment(
  db: ReturnType<typeof getServiceClient>,
  name: string,
  slug: string,
): Promise<{ id: string } | { error: string }> {
  const bySlug = await db.from('departments').select('id').eq('slug', slug).maybeSingle()
  if (bySlug.error) return { error: "Couldn't create that. Try again." }
  if (bySlug.data) return bySlug.data

  const byName = await db
    .from('departments')
    .select('id')
    .ilike('name', name)
    .maybeSingle()
  if (byName.error) return { error: "Couldn't create that. Try again." }
  if (byName.data) return byName.data

  const created = await db
    .from('departments')
    .insert({ name, slug })
    .select('id')
    .single()
  if (created.data) return created.data
  if (created.error?.code === '23505') {
    const raced = await db.from('departments').select('id').eq('slug', slug).maybeSingle()
    if (raced.data) return raced.data
  }
  if (created.error?.code === '23503') return { error: 'That department is not available.' }
  return { error: "Couldn't create that. Try again." }
}

async function findOrCreateYear(
  db: ReturnType<typeof getServiceClient>,
  departmentId: string,
  number: number,
): Promise<{ id: string } | { error: string }> {
  const existing = await db
    .from('years')
    .select('id')
    .eq('department_id', departmentId)
    .eq('number', number)
    .maybeSingle()
  if (existing.error) return { error: "Couldn't create that. Try again." }
  if (existing.data) return existing.data

  const created = await db
    .from('years')
    .insert({ department_id: departmentId, number })
    .select('id')
    .single()
  if (created.data) return created.data
  if (created.error?.code === '23505') {
    const raced = await db
      .from('years')
      .select('id')
      .eq('department_id', departmentId)
      .eq('number', number)
      .maybeSingle()
    if (raced.data) return raced.data
  }
  if (created.error?.code === '23503') return { error: 'That department is no longer available.' }
  return { error: "Couldn't create that. Try again." }
}

async function findOrCreateBatch(
  db: ReturnType<typeof getServiceClient>,
  yearId: string,
  number: number,
): Promise<{ id: string } | { error: string }> {
  const existing = await db
    .from('batches')
    .select('id')
    .eq('year_id', yearId)
    .eq('number', number)
    .maybeSingle()
  if (existing.error) return { error: "Couldn't create that. Try again." }
  if (existing.data) return existing.data

  const created = await db
    .from('batches')
    .insert({ year_id: yearId, number })
    .select('id')
    .single()
  if (created.data) return created.data
  if (created.error?.code === '23505') {
    const raced = await db
      .from('batches')
      .select('id')
      .eq('year_id', yearId)
      .eq('number', number)
      .maybeSingle()
    if (raced.data) return raced.data
  }
  if (created.error?.code === '23503') return { error: 'That year is no longer available.' }
  return { error: "Couldn't create that. Try again." }
}

export async function createRoom(input: RoomInput): Promise<ActionResult<{ id: string }>> {
  const department = input.department.trim()
  if (!department) return err('invalid', 'Give the department a name.')
  if (department.length > 60) {
    return err('invalid', 'That department name is too long. Keep it under 60 characters.')
  }
  if (!DEPARTMENT_NAME.test(department)) {
    return err('invalid', 'Department names can use letters, numbers, spaces and dashes.')
  }
  if (!Number.isInteger(input.year) || input.year < 1 || input.year > 5) {
    return err('invalid', 'Year must be between 1 and 5.')
  }
  if (!Number.isInteger(input.batch) || input.batch < 1 || input.batch > 8) {
    return err('invalid', 'Batch number must be between 1 and 8.')
  }

  const label = input.label.trim().toUpperCase()
  if (!LABEL.test(label)) return err('invalid', 'Room name is 1 to 3 letters, like A or B.')

  const slug = departmentSlug(department)
  if (!SLUG.test(slug)) {
    return err('invalid', 'That department name is too long for a room URL.')
  }
  if (RESERVED_SLUGS.has(slug)) return err('invalid', 'That department name is reserved.')

  const creator = await creatorIdentity(input.token)
  if (!creator.ok) return creator

  const db = getServiceClient()
  const dept = await findOrCreateDepartment(db, department, slug)
  if ('error' in dept) return err('server', dept.error)

  const year = await findOrCreateYear(db, dept.id, input.year)
  if ('error' in year) return err('server', year.error)

  const batch = await findOrCreateBatch(db, year.id, input.batch)
  if ('error' in batch) return err('server', batch.error)

  const { data, error } = await db
    .from('groups')
    .insert({
      batch_id: batch.id,
      label,
      created_by_admin_id: creator.data.adminId,
      created_by_hash: creator.data.hash,
    })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That room already exists.')
  if (error?.code === '23503') return err('invalid', 'That batch no longer exists.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function createGroup(input: {
  batchId: string
  label: string
  token?: string
}): Promise<ActionResult<{ id: string }>> {
  // Stored uppercase, and the room URL lowercases it. The room page looks the group up
  // with .eq('label', group.toUpperCase()), so a lowercase row would be unreachable.
  const label = input.label.trim().toUpperCase()
  if (!LABEL.test(label)) {
    return err('invalid', 'Room name is 1 to 3 letters, like A or B.')
  }

  // Validated before the rate check: a rejected label must not consume the creator's
  // quota, the same order the message path uses.
  const creator = await creatorIdentity(input.token)
  if (!creator.ok) return creator

  const db = getServiceClient()
  const { data, error } = await db
    .from('groups')
    .insert({
      batch_id: input.batchId,
      label,
      created_by_admin_id: creator.data.adminId,
      created_by_hash: creator.data.hash,
    })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That room already exists.')
  if (error?.code === '23503') return err('invalid', 'That batch no longer exists.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function createRoomForm(
  _prev: StructureState,
  form: FormData,
): Promise<StructureState> {
  const department = text(form, 'department')
  const year = Number(text(form, 'year'))
  const batch = Number(text(form, 'batch'))
  const label = text(form, 'label')
  const result = await createRoom({
    department,
    year,
    batch,
    label,
    token: text(form, 'token'),
  })
  return toStructureState(result, `Created room ${label.trim().toUpperCase()}.`)
}

type RoomOwnership = {
  batch_id: string
  created_by_admin_id: string | null
  created_by_hash: string | null
}

async function loadOwnership(groupId: string): Promise<RoomOwnership | null> {
  const db = getServiceClient()
  const { data } = await db
    .from('groups')
    .select('batch_id, created_by_admin_id, created_by_hash')
    .eq('id', groupId)
    .maybeSingle()

  return data ?? null
}

// The single ownership verdict. A co-admin who signs in after creating a room anonymously
// keeps both routes to it: the session covers admin-created rooms, the token still covers
// the anonymous one. The owner is the only identity that skips the check.
async function mayDelete(room: RoomOwnership, token: string | undefined): Promise<boolean> {
  const session = await currentAdmin()
  if (session?.role === 'owner') return true
  if (session && room.created_by_admin_id === session.adminId) return true

  const raw = token?.trim()
  if (!raw || !room.created_by_hash) return false
  return room.created_by_hash === hashToken(raw)
}

// Read-only companion so the room page can hide the control instead of offering an
// action that would be refused. It answers about the caller's own token only.
export async function canDeleteRoom(input: {
  groupId: string
  token?: string
}): Promise<ActionResult<{ canDelete: boolean }>> {
  const room = await loadOwnership(input.groupId)
  if (!room) return ok({ canDelete: false })
  return ok({ canDelete: await mayDelete(room, input.token) })
}

export async function deleteRoom(input: {
  groupId: string
  token?: string
}): Promise<ActionResult<null>> {
  const room = await loadOwnership(input.groupId)
  if (!room) return err('invalid', 'That room is already gone.')

  if (!(await mayDelete(room, input.token))) {
    return err('unauthorized', 'You can only delete a room you created.')
  }

  // A hard delete, unlike a message: a room that merely hid itself would keep pointing
  // at every path in the picker and the sidebar. Messages cascade with the row, and no
  // client subscribes to messages DELETE events, so nothing broadcasts a broken id.
  const db = getServiceClient()
  const { error } = await db.from('groups').delete().eq('id', input.groupId)
  if (error) return err('server', "Couldn't delete that room. Try again.")

  // A room is the only useful leaf in this hierarchy. Once the last room is gone,
  // remove empty parents too so the admin tree never accumulates dead structure.
  const { count: roomsLeft } = await db
    .from('groups')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', room.batch_id)
  if (roomsLeft !== 0) return ok(null)

  const { data: batch } = await db
    .from('batches')
    .select('id, year_id')
    .eq('id', room.batch_id)
    .maybeSingle()
  if (!batch) return ok(null)
  await db.from('batches').delete().eq('id', batch.id)

  const { count: batchesLeft } = await db
    .from('batches')
    .select('id', { count: 'exact', head: true })
    .eq('year_id', batch.year_id)
  if (batchesLeft !== 0) return ok(null)

  const { data: year } = await db
    .from('years')
    .select('id, department_id')
    .eq('id', batch.year_id)
    .maybeSingle()
  if (!year) return ok(null)
  await db.from('years').delete().eq('id', year.id)

  const { count: yearsLeft } = await db
    .from('years')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', year.department_id)
  if (yearsLeft !== 0) return ok(null)
  await db.from('departments').delete().eq('id', year.department_id)
  return ok(null)
}

// ── Form-action wrapper ─────────────────────────────────────────────────────────
// Works with JavaScript disabled and keeps the room form out of the client bundle's
// mutation path. `token` rides in the form because the anonymous identity lives in
// localStorage, which only the browser can read.

const text = (form: FormData, key: string): string => {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

export async function createGroupForm(
  _prev: StructureState,
  form: FormData,
): Promise<StructureState> {
  const label = text(form, 'label').trim().toUpperCase()
  const result = await createGroup({
    batchId: text(form, 'batchId'),
    label,
    token: text(form, 'token'),
  })
  return toStructureState(result, `Created room ${label}.`)
}
