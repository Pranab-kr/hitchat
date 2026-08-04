import { createClient } from '@supabase/supabase-js'

export const testDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type SeededRoom = { groupId: string; deptId: string }

export async function seedRoom(): Promise<SeededRoom> {
  const { data: dept } = await testDb
    .from('departments')
    .insert({
      name: 'Test Dept',
      slug: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    })
    .select('id')
    .single()

  const { data: year } = await testDb
    .from('years')
    .insert({ department_id: dept!.id, number: 1 })
    .select('id')
    .single()

  const { data: batch } = await testDb
    .from('batches')
    .insert({ year_id: year!.id, number: 1 })
    .select('id')
    .single()

  const { data: group } = await testDb
    .from('groups')
    .insert({ batch_id: batch!.id, label: 'A' })
    .select('id')
    .single()

  return { groupId: group!.id, deptId: dept!.id }
}

// Cascades to years, batches, groups, messages and reactions.
export async function teardownRoom(room: SeededRoom): Promise<void> {
  await testDb.from('departments').delete().eq('id', room.deptId)
}
