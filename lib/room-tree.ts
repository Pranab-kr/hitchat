import 'server-only'
import { getServiceClient } from './supabase/admin'
import type { DeptNode, GroupNode } from './rooms'

// One definition of the room hierarchy fetch, shared by the `/` picker and the in-room
// sidebar so the two views can never drift. Both render this already-sorted, already-
// pruned tree directly — no consumer re-sorts or re-filters. The shape and the `ordinal`
// helper live in lib/rooms.ts so client components can import them without pulling this
// server-only module (and the service client) into the browser bundle.

// PostgREST types nested selects loosely; assert the shape once here rather than with an
// `any` cast at each use site (the same pattern the picker used inline before).
type RawDept = { id: string; name: string; slug: string; years: RawYear[] | null }
type RawYear = { number: number; batches: RawBatch[] | null }
type RawBatch = { number: number; groups: GroupNode[] | null }

export async function getRoomTree(): Promise<DeptNode[]> {
  const db = getServiceClient()
  const { data } = await db
    .from('departments')
    .select('id, name, slug, years(number, batches(number, groups(label)))')
    .order('sort_order')

  const departments = (data ?? []) as unknown as RawDept[]

  // Prune bottom-up so a batch/year/department with no rooms under it is dropped, then
  // sort every level. A department kept in `sort_order`; years and batches ascending;
  // groups by label. An empty node is noise in the picker and a dead expandable in the
  // sidebar, so neither ever sees one.
  return departments
    .map((dept) => ({
      id: dept.id,
      name: dept.name,
      slug: dept.slug,
      years: [...(dept.years ?? [])]
        .map((year) => ({
          number: year.number,
          batches: [...(year.batches ?? [])]
            .map((batch) => ({
              number: batch.number,
              groups: [...(batch.groups ?? [])].sort((a, b) =>
                a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
              ),
            }))
            .filter((batch) => batch.groups.length > 0)
            .sort((a, b) => a.number - b.number),
        }))
        .filter((year) => year.batches.length > 0)
        .sort((a, b) => a.number - b.number),
    }))
    .filter((dept) => dept.years.length > 0)
}
