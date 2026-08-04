// @vitest-environment node
//
// Live Realtime test with the PUBLISHABLE key — the same channel config
// lib/use-realtime-messages.ts subscribes with. This is what proves the publication,
// the group_id filter, and the column-level grants actually work over the socket.
import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import { getServiceClient } from '../lib/supabase/admin'
import { MESSAGE_COLUMNS } from '../lib/columns'

const db = getServiceClient()
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
)

const deptIds: string[] = []

async function seedRoom() {
  const { data: dept } = await db
    .from('departments')
    .insert({ name: 'Realtime Probe', slug: `rt-probe-${crypto.randomUUID()}` })
    .select('id')
    .single()
  deptIds.push(dept!.id)

  const { data: year } = await db
    .from('years')
    .insert({ department_id: dept!.id, number: 1 })
    .select('id')
    .single()
  const { data: batch } = await db
    .from('batches')
    .insert({ year_id: year!.id, number: 1 })
    .select('id')
    .single()
  const { data: group } = await db
    .from('groups')
    .insert({ batch_id: batch!.id, label: 'RT-PROBE' })
    .select('id')
    .single()
  return group!.id as string
}

afterAll(async () => {
  await anon.removeAllChannels()
  // departments cascades to years -> batches -> groups -> messages.
  for (const id of deptIds) await db.from('departments').delete().eq('id', id)
})

async function insertMessage(groupId: string, body: string) {
  const { error } = await db.from('messages').insert({
    group_id: groupId,
    kind: 'text',
    body,
    author_token_hash: `rt-probe-hash-${crypto.randomUUID()}`,
    author_name: 'Quiet Otter 01',
    author_color: '#2064B6',
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  })
  expect(error).toBeNull()
}

async function waitForSubscribed(channel: RealtimeChannel) {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 20000)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve(true)
      }
    })
  })
}

async function poll(arrived: () => boolean, ms = 15000) {
  for (let i = 0; i < ms / 250 && !arrived(); i++) {
    await new Promise((r) => setTimeout(r, 250))
  }
  return arrived()
}

// A tenant whose Realtime instance is cold creates its replication slot *after* the
// client sees SUBSCRIBED, so the first INSERT can be dropped. Observed for real on
// 2026-08-04: this file failed once against a cold tenant, then passed on every warm
// run. The app tolerates it because the hook refetches on SUBSCRIBED; a socket-level
// assertion needs an explicit warm-up instead.
async function warmUp(groupId: string, arrived: () => boolean) {
  await insertMessage(groupId, 'realtime warm-up')
  await poll(arrived, 10000)
}

describe('Realtime message delivery', () => {
  it('delivers an INSERT to a publishable-key subscriber without the token hash', async () => {
    const groupId = await seedRoom()
    const received: Record<string, unknown>[] = []

    const channel = anon.channel(`room:${groupId}`).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
      (p) => received.push(p.new as Record<string, unknown>),
    )

    expect(await waitForSubscribed(channel)).toBe(true)
    await warmUp(groupId, () => received.length > 0)

    received.length = 0
    await insertMessage(groupId, 'realtime probe body')
    expect(await poll(() => received.length > 0)).toBe(true)
    expect(received[0].body).toBe('realtime probe body')

    // Column-level grants must apply to the Realtime payload too.
    expect(received[0]).not.toHaveProperty('author_token_hash')
    expect(Object.keys(received[0]).sort()).toEqual(MESSAGE_COLUMNS.split(', ').sort())
  }, 120000)

  it('delivers a soft delete as an UPDATE, never a DELETE event', async () => {
    const groupId = await seedRoom()
    const inserts: Record<string, unknown>[] = []
    const updates: Record<string, unknown>[] = []
    const deletes: unknown[] = []

    const channel = anon
      .channel(`room:${groupId}:update`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (p) => inserts.push(p.new as Record<string, unknown>),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (p) => updates.push(p.new as Record<string, unknown>),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) =>
        deletes.push(p.old),
      )

    expect(await waitForSubscribed(channel)).toBe(true)
    await warmUp(groupId, () => inserts.length > 0)

    inserts.length = 0
    await insertMessage(groupId, 'about to be deleted')
    expect(await poll(() => inserts.length > 0)).toBe(true)
    const id = inserts[0].id as string

    // What moderation actually does: soft-delete via UPDATE, blanking the body.
    await db
      .from('messages')
      .update({ deleted_at: new Date().toISOString(), body: '' })
      .eq('id', id)

    expect(await poll(() => updates.length > 0)).toBe(true)
    expect(updates[0].id).toBe(id)
    expect(updates[0].deleted_at).not.toBeNull()
    expect(updates[0].body).toBe('')
    expect(deletes).toHaveLength(0)
  }, 120000)

  it('does not deliver messages from another group', async () => {
    const groupA = await seedRoom()
    const { data: row } = await db
      .from('groups')
      .select('batch_id')
      .eq('id', groupA)
      .single()
    const { data: other } = await db
      .from('groups')
      .insert({ batch_id: row!.batch_id, label: 'RT-OTHER' })
      .select('id')
      .single()

    const received: unknown[] = []
    const channel = anon.channel(`room:${groupA}:filter`).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupA}` },
      (p) => received.push(p.new),
    )

    expect(await waitForSubscribed(channel)).toBe(true)

    // Prove the socket is live before asserting a negative — a dead subscription would
    // otherwise pass this test for entirely the wrong reason.
    await warmUp(groupA, () => received.length > 0)
    expect(received.length).toBeGreaterThan(0)

    received.length = 0
    await insertMessage(other!.id, 'should not arrive')
    await new Promise((r) => setTimeout(r, 5000))
    expect(received).toHaveLength(0)
  }, 120000)
})
