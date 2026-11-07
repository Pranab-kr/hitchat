import 'server-only'
import { getServiceClient } from '@/lib/supabase/admin'
import { findRoomByPath, type RoomHit } from '@/lib/rooms-server'

// A room is addressed by the same path the browser URL uses: cse/3/2/A. Agents never
// see a group id, so nothing has to guess a UUID or know the schema.

export type RoomSummary = {
  path: string
  dept: string
  year: number
  batch: number
  group: string
  locked: boolean
}

export type ResolvedRoom = RoomHit & {
  dept: string
  year: number
  batch: number
  group: string
}

export function parseRoomPath(
  input: string,
): { dept: string; year: number; batch: number; group: string } | null {
  const parts = input.trim().split('/')
  if (parts.length !== 4) return null

  const [dept, year, batch, group] = parts.map((part) => part.trim())
  if (!dept || !year || !batch || !group) return null

  const yearNumber = Number(year)
  const batchNumber = Number(batch)
  if (!Number.isInteger(yearNumber) || !Number.isInteger(batchNumber)) return null

  return {
    dept: dept.toLowerCase(),
    year: yearNumber,
    batch: batchNumber,
    group: group.toUpperCase(),
  }
}

type RawGroup = { label: string; is_locked: boolean }
type RawBatch = { number: number; groups: RawGroup[] | null }
type RawYear = { number: number; batches: RawBatch[] | null }
type RawDept = { slug: string; years: RawYear[] | null }

const byNumber = <T extends { number: number }>(a: T, b: T) => a.number - b.number
const byLabel = (a: RawGroup, b: RawGroup) =>
  a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })

export async function listRooms(): Promise<RoomSummary[]> {
  const db = getServiceClient()
  const { data } = await db
    .from('departments')
    .select('slug, years(number, batches(number, groups(label, is_locked)))')
    .order('sort_order')

  // getRoomTree() cannot be reused here: its select never asks for is_locked, and an
  // agent needs to know a room is read-only before it tries to post. Same pruning and
  // ordering rules as the sidebar, though — empty nodes are dropped, everything else is
  // sorted the way a person reads it.
  const departments = (data ?? []) as unknown as RawDept[]
  const rooms: RoomSummary[] = []

  for (const dept of departments) {
    const years = [...(dept.years ?? [])].sort(byNumber)

    for (const year of years) {
      const batches = [...(year.batches ?? [])].sort(byNumber)

      for (const batch of batches) {
        const groups = [...(batch.groups ?? [])].sort(byLabel)

        for (const group of groups) {
          rooms.push({
            path: `${dept.slug}/${year.number}/${batch.number}/${group.label}`,
            dept: dept.slug,
            year: year.number,
            batch: batch.number,
            group: group.label,
            locked: group.is_locked,
          })
        }
      }
    }
  }

  return rooms
}

export async function resolveRoom(input: string): Promise<ResolvedRoom | null> {
  const parsed = parseRoomPath(input)
  if (!parsed) return null

  const hit = await findRoomByPath(parsed.dept, parsed.year, parsed.batch, parsed.group)
  if (!hit) return null

  return { ...hit, ...parsed }
}
