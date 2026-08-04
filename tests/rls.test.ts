// Runs against the live Supabase project over the network — no DOM needed.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

const anon = createClient(url, key)

describe('RLS: the publishable key is read-only', () => {
  it('cannot insert a message', async () => {
    const { error } = await anon.from('messages').insert({
      group_id: '00000000-0000-0000-0000-000000000000',
      kind: 'text',
      body: 'should not work',
      author_token_hash: 'x',
      author_name: 'x',
      author_color: 'x',
    })
    expect(error).not.toBeNull()
  })

  // Scoped to a non-existent id on purpose. The permission check fires before any
  // row is matched, so a missing grant still errors — but if the grant ever leaks in,
  // this fails by returning no error instead of rewriting the live messages table.
  it('cannot update a message', async () => {
    const { error } = await anon.from('messages').update({ body: 'hacked' }).eq('id', '00000000-0000-0000-0000-000000000000')
    expect(error).not.toBeNull()
  })

  it('cannot delete a message', async () => {
    const { error } = await anon.from('messages').delete().eq('id', '00000000-0000-0000-0000-000000000000')
    expect(error).not.toBeNull()
  })

  it('cannot read author_token_hash', async () => {
    const { error } = await anon.from('messages').select('author_token_hash')
    expect(error).not.toBeNull()
  })

  it('cannot select * from messages', async () => {
    const { error } = await anon.from('messages').select('*')
    expect(error).not.toBeNull()
  })

  it('cannot read the admins table at all', async () => {
    const { data, error } = await anon.from('admins').select('id')
    expect(error ?? data).toBeTruthy()
    expect(data ?? []).toHaveLength(0)
  })

  it('cannot read admin_sessions, bans, or rate_events', async () => {
    for (const table of ['admin_sessions', 'bans', 'rate_events']) {
      const { data } = await anon.from(table).select('*')
      expect(data ?? []).toHaveLength(0)
    }
  })

  it('can read the granted message columns', async () => {
    const { error } = await anon.from('messages').select('id, body, created_at')
    expect(error).toBeNull()
  })
})
