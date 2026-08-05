// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedRoom, teardownRoom, testDb, type SeededRoom } from './helpers/seed-room'

let room: SeededRoom
let groupId: string

// Rate-limit state lives in the database and outlives the process, so a fixed token
// string exhausts its own quota when the suite runs twice inside a window.
const RUN = Math.random().toString(36).slice(2, 8)
const tok = (name: string) => `${name}-${RUN}`

beforeAll(async () => {
  room = await seedRoom()
  groupId = room.groupId
})

afterAll(async () => {
  await teardownRoom(room)
})

describe('toggleReaction', () => {
  it('adds a reaction, then removes it on second toggle', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { toggleReaction } = await import('../app/actions/reactions')

    const posted = await sendText({ token: tok('reactor'), groupId, body: 'react to me' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const added = await toggleReaction({
      token: tok('reactor'),
      messageId: posted.data.id,
      emoji: 'works',
    })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(added.data.counts.works).toBe(1)
    expect(added.data.mine).toContain('works')

    const removed = await toggleReaction({
      token: tok('reactor'),
      messageId: posted.data.id,
      emoji: 'works',
    })
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.data.counts.works ?? 0).toBe(0)
    expect(removed.data.mine).not.toContain('works')
  }, 30000)

  it('rejects an emoji outside the fixed set', async () => {
    const { toggleReaction } = await import('../app/actions/reactions')
    const result = await toggleReaction({
      token: tok('reactor'),
      messageId: '00000000-0000-0000-0000-000000000000',
      emoji: 'poop',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })

  it('never returns a token hash to the caller', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { toggleReaction } = await import('../app/actions/reactions')

    const posted = await sendText({ token: tok('hasher'), groupId, body: 'hash check' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const result = await toggleReaction({
      token: tok('hasher'),
      messageId: posted.data.id,
      emoji: 'fire',
    })

    expect(result.ok).toBe(true)
    expect(JSON.stringify(result)).not.toContain('author_token_hash')
    const { hashToken } = await import('../lib/identity')
    expect(JSON.stringify(result)).not.toContain(hashToken(tok('hasher')))
  }, 30000)

  it('counts another person as a separate reaction and does not claim it as mine', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { toggleReaction, getReactions } = await import('../app/actions/reactions')

    const posted = await sendText({ token: tok('author-a'), groupId, body: 'two people' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    await toggleReaction({ token: tok('one'), messageId: posted.data.id, emoji: 'eyes' })
    const second = await toggleReaction({
      token: tok('two'),
      messageId: posted.data.id,
      emoji: 'eyes',
    })

    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.data.counts.eyes).toBe(2)
    expect(second.data.mine).toEqual(['eyes'])

    // A third party sees the count but owns none of it.
    const outside = await getReactions({
      token: tok('bystander'),
      messageIds: [posted.data.id],
    })
    expect(outside.ok).toBe(true)
    if (!outside.ok) return
    expect(outside.data[posted.data.id].counts.eyes).toBe(2)
    expect(outside.data[posted.data.id].mine).toEqual([])
  }, 30000)

  it('bumps reaction_bump on the parent message so the UPDATE subscription carries it', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { toggleReaction } = await import('../app/actions/reactions')

    const posted = await sendText({ token: tok('bumper'), groupId, body: 'bump me' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const { data: before } = await testDb
      .from('messages')
      .select('reaction_bump')
      .eq('id', posted.data.id)
      .single()

    await toggleReaction({
      token: tok('bumper'),
      messageId: posted.data.id,
      emoji: 'buggy',
    })

    const { data: after } = await testDb
      .from('messages')
      .select('reaction_bump')
      .eq('id', posted.data.id)
      .single()

    expect(new Date(after!.reaction_bump).getTime()).toBeGreaterThan(
      new Date(before!.reaction_bump).getTime(),
    )
  }, 30000)

  it('refuses a reaction in a locked room', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { toggleReaction } = await import('../app/actions/reactions')

    const posted = await sendText({ token: tok('locked-r'), groupId, body: 'before lock' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    await testDb.from('groups').update({ is_locked: true }).eq('id', groupId)
    const result = await toggleReaction({
      token: tok('locked-r'),
      messageId: posted.data.id,
      emoji: 'works',
    })
    await testDb.from('groups').update({ is_locked: false }).eq('id', groupId)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('locked')
  }, 30000)

  it('refuses a reaction on a deleted message', async () => {
    const { sendText, deleteOwnMessage } = await import('../app/actions/messages')
    const { toggleReaction } = await import('../app/actions/reactions')

    const posted = await sendText({ token: tok('deleter'), groupId, body: 'delete me' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const deleted = await deleteOwnMessage({
      token: tok('deleter'),
      messageId: posted.data.id,
    })
    expect(deleted.ok).toBe(true)

    const result = await toggleReaction({
      token: tok('deleter'),
      messageId: posted.data.id,
      emoji: 'works',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  }, 30000)
})

describe('getReactions', () => {
  it('returns an empty entry for a message with no reactions', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { getReactions } = await import('../app/actions/reactions')

    const posted = await sendText({ token: tok('empty'), groupId, body: 'no reactions' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const result = await getReactions({
      token: tok('empty'),
      messageIds: [posted.data.id],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data[posted.data.id]).toEqual({ counts: {}, mine: [] })
  }, 30000)

  it('short-circuits on an empty id list', async () => {
    const { getReactions } = await import('../app/actions/reactions')
    const result = await getReactions({ token: tok('nobody'), messageIds: [] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toEqual({})
  })

  it('rejects an oversized id list', async () => {
    const { getReactions } = await import('../app/actions/reactions')
    const ids = Array.from({ length: 101 }, () => '00000000-0000-0000-0000-000000000000')
    const result = await getReactions({ token: tok('flooder'), messageIds: ids })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })
})
