import { createClient } from '@supabase/supabase-js'

export const testDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type SeededRoom = { groupId: string; deptId: string }

export async function seedRoom(): Promise<SeededRoom> {
  // Every insert is error-checked. Without this a transient failure against ap-south-1
  // surfaces as "Cannot read properties of undefined (reading 'id')" from the next line
  // down, which says nothing about what actually went wrong.
  const { data: dept, error: deptError } = await testDb
    .from('departments')
    .insert({
      name: 'Test Dept',
      slug: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    })
    .select('id')
    .single()
  if (deptError) throw new Error(`seedRoom: departments insert failed: ${deptError.message}`)

  const { data: year, error: yearError } = await testDb
    .from('years')
    .insert({ department_id: dept!.id, number: 1 })
    .select('id')
    .single()
  if (yearError) throw new Error(`seedRoom: years insert failed: ${yearError.message}`)

  const { data: batch, error: batchError } = await testDb
    .from('batches')
    .insert({ year_id: year!.id, number: 1 })
    .select('id')
    .single()
  if (batchError) throw new Error(`seedRoom: batches insert failed: ${batchError.message}`)

  const { data: group, error: groupError } = await testDb
    .from('groups')
    .insert({ batch_id: batch!.id, label: 'A' })
    .select('id')
    .single()
  if (groupError) throw new Error(`seedRoom: groups insert failed: ${groupError.message}`)

  return { groupId: group!.id, deptId: dept!.id }
}

// Cascades to years, batches, groups, messages and reactions. Tolerates a room that
// never fully seeded, so a failed beforeAll does not also break afterAll and hide it.
export async function teardownRoom(room: SeededRoom | undefined): Promise<void> {
  if (!room?.deptId) return
  await testDb.from('departments').delete().eq('id', room.deptId)
}
