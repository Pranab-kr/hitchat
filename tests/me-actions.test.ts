// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testDb as db, seedRoom, teardownRoom, type SeededRoom } from './helpers/seed-room'

let room: SeededRoom
let groupId: string

// Rate-limit and ban state live in the database and outlive the process, so a fixed
// token would collide across runs inside a window. Same lesson as messages-action.test.
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const tok = (name: string) => `${name}-${RUN}`

// Every hash that posts or gets banned, so afterAll can sweep rate events and bans
// even when an assertion fails partway through.
const hashes: string[] = []

beforeAll(async () => {
  room = await seedRoom()
  groupId = room.groupId
})

afterAll(async () => {
  if (hashes.length) {
    await db.from('bans').delete().in('author_token_hash', hashes)
    await db.from('rate_events').delete().in('author_token_hash', hashes)
  }
  await teardownRoom(room)
})

describe('getOwnMessageIds', () => {
  it('returns only the caller’s message ids, never a token hash', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { hashToken } = await import('../lib/identity')
    const { getOwnMessageIds } = await import('../app/actions/me')

    const mine = await sendText({ token: tok('mine'), groupId, body: 'my post' })
    const theirs = await sendText({ token: tok('theirs'), groupId, body: 'their post' })
    hashes.push(hashToken(tok('mine')), hashToken(tok('theirs')))
    expect(mine.ok && theirs.ok).toBe(true)
    if (!mine.ok || !theirs.ok) return

    const result = await getOwnMessageIds({
      token: tok('mine'),
      messageIds: [mine.data.id, theirs.data.id],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.ids).toEqual([mine.data.id])
    expect(JSON.stringify(result)).not.toContain(hashToken(tok('mine')))
    expect(JSON.stringify(result)).not.toContain('author_token_hash')
  }, 30000)

  it('short-circuits on an empty id list', async () => {
    const { getOwnMessageIds } = await import('../app/actions/me')
    const result = await getOwnMessageIds({ token: tok('nobody'), messageIds: [] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.ids).toEqual([])
  })

  it('rejects an oversized id list', async () => {
    const { getOwnMessageIds } = await import('../app/actions/me')
    const ids = Array.from({ length: 101 }, () => '00000000-0000-0000-0000-000000000000')
    const result = await getOwnMessageIds({ token: tok('flooder'), messageIds: ids })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid')
  })
})

describe('getPostingStatus', () => {
  it('reports null when the token is not banned', async () => {
    const { getPostingStatus } = await import('../app/actions/me')
    const result = await getPostingStatus({ token: tok('clean') })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.bannedMessage).toBeNull()
  })

  it('reports the ban message while banned', async () => {
    const { hashToken } = await import('../lib/identity')
    const { getPostingStatus } = await import('../app/actions/me')
    const hash = hashToken(tok('banned-gate'))
    hashes.push(hash)

    await db.from('bans').insert({
      author_token_hash: hash,
      until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    const result = await getPostingStatus({ token: tok('banned-gate') })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.bannedMessage).toMatch(/can't post here until/)
  })
})
