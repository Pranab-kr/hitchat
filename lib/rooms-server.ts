import 'server-only'
import { getServiceClient } from '@/lib/supabase/admin'

// One definition of "find the room at this path", shared by the room page and the
// agent surfaces so the two can never disagree about what exists. The page used to
// carry this query inline; it moved here when agents needed the same lookup.

export type RoomHit = {
  id: string
  label: string
  isLocked: boolean
  deptName: string
  // Creator ownership, read here so the room page can decide who may delete it without
  // a second query. The hash itself never leaves the server — only whether one exists.
  createdByAdminId: string | null
  creatorIsAnon: boolean
}

// PostgREST hands a to-one embed back as either an object or a single-element array
// depending on how it inferred the relationship, so normalise before reading.
const one = <T,>(value: T | T[]): T => (Array.isArray(value) ? value[0] : value)

type RoomDept = { name: string }
type RoomYear = { departments: RoomDept | RoomDept[] }
type RoomBatch = { years: RoomYear | RoomYear[] }

export async function findRoomByPath(
  dept: string,
  year: number,
  batch: number,
  group: string,
): Promise<RoomHit | null> {
  // The page rejects non-numeric URL segments before querying, because Number('abc') is
  // NaN and .eq('number', NaN) makes PostgREST 400 rather than 404. Agents reach this
  // function directly, so the same guard lives here too.
  if (!Number.isInteger(year) || !Number.isInteger(batch)) return null

  const db = getServiceClient()
  const { data } = await db
    .from('groups')
    .select(
      'id, label, is_locked, created_by_admin_id, created_by_hash, batches!inner(number, years!inner(number, departments!inner(slug, name)))',
    )
    .eq('label', group.toUpperCase())
    .eq('batches.number', batch)
    .eq('batches.years.number', year)
    .eq('batches.years.departments.slug', dept.toLowerCase())
    .maybeSingle()

  if (!data) return null

  const foundBatch = one((data as unknown as { batches: RoomBatch | RoomBatch[] }).batches)
  const deptName = one(one(foundBatch.years).departments).name

  return {
    id: data.id,
    label: data.label,
    isLocked: data.is_locked,
    deptName,
    createdByAdminId: data.created_by_admin_id,
    creatorIsAnon: data.created_by_hash !== null,
  }
}
