// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getServiceClient } from '../lib/supabase/admin'
import { hashToken } from '../lib/identity'
import { seedRoom, teardownRoom, type SeededRoom } from './helpers/seed-room'

let filterRoom: SeededRoom
let orderRoom: SeededRoom

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const rawToken = `read-test-${RUN}`

function messageRow(groupId: string, overrides: Record<string, unknown> = {}) {
  return {
    group_id: groupId,
    kind: 'text',
    body: 'body',
    author_token_hash: hashToken(rawToken),
    author_name: 'ReadTest001',
    author_color: '#2C5F8F',
    // Set explicitly on every row: PostgREST builds a bulk insert from the union of the
    // rows' keys, so a row that omits this sends null and trips the not-null constraint
    // instead of taking the column default.
    expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

beforeAll(async () => {
  filterRoom = await seedRoom()
  orderRoom = await seedRoom()

  const db = getServiceClient()

  const { error: filterError } = await db.from('messages').insert([
    messageRow(filterRoom.groupId, { body: 'live message' }),
    messageRow(filterRoom.groupId, {
      body: '',
      deleted_at: new Date().toISOString(),
    }),
    messageRow(filterRoom.groupId, {
      body: 'expired message',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    }),
    messageRow(filterRoom.groupId, {
      kind: 'code',
      body: 'x'.repeat(10_000),
      code_lang: 'c',
      code_title: 'Long one',
      lab_tag: 'Lab 3',
    }),
  ])
  if (filterError) throw new Error(`read test seed failed: ${filterError.message}`)

  const base = Date.now() - 60_000
  const rows = Array.from({ length: 52 }, (_, i) =>
    messageRow(orderRoom.groupId, {
      body: `m-${i}`,
      created_at: new Date(base + i * 1000).toISOString(),
    }),
  )
  const { error: orderError } = await db.from('messages').insert(rows)
  if (orderError) throw new Error(`read test bulk seed failed: ${orderError.message}`)
})

afterAll(async () => {
  await teardownRoom(filterRoom)
  await teardownRoom(orderRoom)
})

describe('readMessages', () => {
  it('returns only live, undeleted messages', async () => {
    const { readMessages } = await import('../lib/agent/read')
    const messages = await readMessages(filterRoom.groupId)

    const bodies = messages.map((m) => m.body)
    expect(bodies).toContain('live message')
    expect(bodies).not.toContain('expired message')
    expect(messages.every((m) => m.body !== '')).toBe(true)
  })

  it('maps stored columns to the agent shape', async () => {
    const { readMessages } = await import('../lib/agent/read')
    const messages = await readMessages(filterRoom.groupId)
    const code = messages.find((m) => m.kind === 'code')

    expect(code).toMatchObject({
      kind: 'code',
      lang: 'c',
      title: 'Long one',
      lab_tag: 'Lab 3',
      author: 'ReadTest001',
      pinned: false,
    })
  })

  it('truncates a long code body to 8000 characters and marks it', async () => {
    const { readMessages } = await import('../lib/agent/read')
    const messages = await readMessages(filterRoom.groupId)
    const code = messages.find((m) => m.kind === 'code')

    expect(code!.body).toHaveLength(8000)
    expect(code!.truncated).toBe(true)
  })

  it('defaults to 20 messages', async () => {
    const { readMessages } = await import('../lib/agent/read')
    const messages = await readMessages(orderRoom.groupId)

    expect(messages).toHaveLength(20)
    expect(messages.at(-1)!.body).toBe('m-51')
  })

  it('clamps 500 down to 50', async () => {
    const { readMessages } = await import('../lib/agent/read')
    const messages = await readMessages(orderRoom.groupId, 500)

    expect(messages).toHaveLength(50)
  })

  it('returns the most recent N, oldest first', async () => {
    const { readMessages } = await import('../lib/agent/read')
    const messages = await readMessages(orderRoom.groupId, 2)

    expect(messages.map((m) => m.body)).toEqual(['m-50', 'm-51'])
  })

  it('clamps zero and negatives up to 1', async () => {
    const { readMessages } = await import('../lib/agent/read')
    expect(await readMessages(orderRoom.groupId, 0)).toHaveLength(1)
    expect(await readMessages(orderRoom.groupId, -5)).toHaveLength(1)
  })
})
