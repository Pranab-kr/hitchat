// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testDb as db, seedRoom, teardownRoom, type SeededRoom } from './helpers/seed-room'

let room: SeededRoom
let groupId: string

// Rate-limit state lives in the database and outlives the process, so fixed token
// strings would exhaust their own quota when the suite runs twice inside a window.
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const tok = (name: string) => `${name}-${RUN}`

beforeAll(async () => {
  room = await seedRoom()
  groupId = room.groupId
})

afterAll(async () => {
  await teardownRoom(room)
})

describe('sendText', () => {
  it('inserts a message and derives the handle server-side', async () => {
    const { sendText } = await import('../app/actions/messages')
    const result = await sendText({
      token: tok('test-token-1'),
      groupId,
      body: 'hello lab',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { data } = await db
      .from('messages')
      .select('body, author_name, kind')
      .eq('id', result.data.id)
      .single()

    expect(data!.body).toBe('hello lab')
    expect(data!.kind).toBe('text')
    expect(data!.author_name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/)
  })

  it('stores the peppered hash, never the raw token', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { hashToken } = await import('../lib/identity')
    const result = await sendText({ token: tok('raw-secret-token'), groupId, body: 'hi' })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { data } = await db
      .from('messages')
      .select('author_token_hash')
      .eq('id', result.data.id)
      .single()

    expect(data!.author_token_hash).toBe(hashToken(tok('raw-secret-token')))
    expect(data!.author_token_hash).not.toContain('raw-secret-token')
  })

  // The plan counted rows for a hash that never posts, which passes even if the
  // quota were consumed. Count this user's own events instead.
  it('rejects a message over 1000 chars without consuming rate quota', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { hashToken } = await import('../lib/identity')
    const hash = hashToken(tok('test-token-2'))

    await db.from('rate_events').delete().eq('author_token_hash', hash)

    const result = await sendText({
      token: tok('test-token-2'),
      groupId,
      body: 'x'.repeat(1001),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')

    const { count } = await db
      .from('rate_events')
      .select('*', { count: 'exact', head: true })
      .eq('author_token_hash', hash)
    expect(count).toBe(0)
  })

  it('rejects posting to a locked room', async () => {
    await db.from('groups').update({ is_locked: true }).eq('id', groupId)

    const { sendText } = await import('../app/actions/messages')
    const result = await sendText({ token: tok('test-token-3'), groupId, body: 'hi' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('locked')

    await db.from('groups').update({ is_locked: false }).eq('id', groupId)
  })

  it('rejects posting to a room that does not exist', async () => {
    const { sendText } = await import('../app/actions/messages')
    const result = await sendText({
      token: tok('test-token-4'),
      groupId: '00000000-0000-0000-0000-000000000000',
      body: 'hi',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })

  it('rejects a banned user', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { hashToken } = await import('../lib/identity')
    const hash = hashToken(tok('banned-token'))

    await db.from('bans').insert({
      author_token_hash: hash,
      until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    const result = await sendText({ token: tok('banned-token'), groupId, body: 'let me in' })

    await db.from('bans').delete().eq('author_token_hash', hash)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('banned')
  })

  it('stops the sixth message in ten seconds', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { hashToken } = await import('../lib/identity')
    const hash = hashToken(tok('flood-token'))
    await db.from('rate_events').delete().eq('author_token_hash', hash)

    const codes: (string | undefined)[] = []
    for (let i = 0; i < 6; i++) {
      const r = await sendText({ token: tok('flood-token'), groupId, body: `msg ${i}` })
      codes.push(r.ok ? undefined : r.code)
    }

    await db.from('rate_events').delete().eq('author_token_hash', hash)

    expect(codes.slice(0, 5)).toEqual([undefined, undefined, undefined, undefined, undefined])
    expect(codes[5]).toBe('rate_limited')
  })
})

describe('postCode', () => {
  it('stores the language and title', async () => {
    const { postCode } = await import('../app/actions/messages')
    const result = await postCode({
      token: tok('code-token'),
      groupId,
      body: 'int main(){}',
      lang: 'c',
      title: 'Q2',
      labTag: 'Lab 4',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { data } = await db
      .from('messages')
      .select('kind, code_lang, code_title, lab_tag')
      .eq('id', result.data.id)
      .single()

    expect(data!.kind).toBe('code')
    expect(data!.code_lang).toBe('c')
    expect(data!.code_title).toBe('Q2')
    expect(data!.lab_tag).toBe('Lab 4')
  })

  it('rejects a language outside the allowed set', async () => {
    const { postCode } = await import('../app/actions/messages')
    const result = await postCode({
      token: tok('code-token-2'),
      groupId,
      body: 'fn main(){}',
      lang: 'rust',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })
})

describe('deleteOwnMessage', () => {
  it("refuses to delete another person's message", async () => {
    const { sendText, deleteOwnMessage } = await import('../app/actions/messages')
    const posted = await sendText({ token: tok('owner-token'), groupId, body: 'mine' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const result = await deleteOwnMessage({
      token: tok('different-token'),
      messageId: posted.data.id,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('unauthorized')

    // The message must survive the refused delete.
    const { data } = await db
      .from('messages')
      .select('body, deleted_at')
      .eq('id', posted.data.id)
      .single()
    expect(data!.body).toBe('mine')
    expect(data!.deleted_at).toBeNull()
  })

  it('soft-deletes and blanks the body', async () => {
    const { sendText, deleteOwnMessage } = await import('../app/actions/messages')
    const posted = await sendText({ token: tok('owner-token'), groupId, body: 'oops' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const result = await deleteOwnMessage({
      token: tok('owner-token'),
      messageId: posted.data.id,
    })
    expect(result.ok).toBe(true)

    const { data } = await db
      .from('messages')
      .select('deleted_at, body')
      .eq('id', posted.data.id)
      .single()

    expect(data!.deleted_at).not.toBeNull()
    expect(data!.body).toBe('')
  })

  it('refuses to delete a message older than 5 minutes', async () => {
    const { hashToken } = await import('../lib/identity')
    const { data: old } = await db
      .from('messages')
      .insert({
        group_id: groupId,
        kind: 'text',
        body: 'old message',
        author_token_hash: hashToken(tok('owner-token')),
        author_name: 'Test User 01',
        author_color: '#2C5F8F',
        created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    const { deleteOwnMessage } = await import('../app/actions/messages')
    const result = await deleteOwnMessage({
      token: tok('owner-token'),
      messageId: old!.id,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('5 minutes')
  })

  it('is idempotent on an already-deleted message', async () => {
    const { sendText, deleteOwnMessage } = await import('../app/actions/messages')
    const posted = await sendText({ token: tok('owner-token'), groupId, body: 'twice' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    await deleteOwnMessage({ token: tok('owner-token'), messageId: posted.data.id })
    const second = await deleteOwnMessage({ token: tok('owner-token'), messageId: posted.data.id })
    expect(second.ok).toBe(true)
  })
})
