// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testDb as db, seedRoom, teardownRoom, type SeededRoom } from './helpers/seed-room'
import { hashToken } from '../lib/identity'

let room: SeededRoom
let otherRoom: SeededRoom

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const tokens: string[] = []

function tok(name: string): string {
  const value = `${name}-${RUN}`
  tokens.push(value)
  return value
}

beforeAll(async () => {
  room = await seedRoom()
  otherRoom = await seedRoom()
})

afterAll(async () => {
  const hashes = tokens.map(hashToken)
  if (hashes.length > 0) {
    await db.from('rate_events').delete().in('author_token_hash', hashes)
    await db.from('bans').delete().in('author_token_hash', hashes)
  }
  await teardownRoom(room)
  await teardownRoom(otherRoom)
})

describe('postAgentText', () => {
  it('inserts a message with the derived handle and no admin', async () => {
    const { postAgentText } = await import('../lib/agent/post')
    const token = tok('basic')

    const result = await postAgentText({
      hash: hashToken(token),
      groupId: room.groupId,
      text: '  hello agent  ',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { data } = await db
      .from('messages')
      .select('kind, body, author_name, author_color, author_token_hash, admin_id')
      .eq('id', result.data.id)
      .single()

    expect(data!.kind).toBe('text')
    expect(data!.body).toBe('hello agent')
    expect(data!.author_name).toMatch(/^[A-Z][a-zA-Z]+\d{3}$/)
    expect(data!.author_color).toMatch(/^#[0-9A-F]{6}$/)
    expect(data!.author_token_hash).toBe(hashToken(token))
    expect(data!.author_token_hash).not.toContain(token)
    expect(data!.admin_id).toBeNull()
  })

  it('rejects a banned token with the unban time in the message', async () => {
    const { postAgentText } = await import('../lib/agent/post')
    const token = tok('banned')
    const hash = hashToken(token)

    await db.from('bans').insert({
      author_token_hash: hash,
      until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    const result = await postAgentText({ hash, groupId: room.groupId, text: 'let me in' })

    await db.from('bans').delete().eq('author_token_hash', hash)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('banned')
    expect(result.message).toContain("can't post")
  })

  it('rejects a locked room', async () => {
    const { postAgentText } = await import('../lib/agent/post')
    await db.from('groups').update({ is_locked: true }).eq('id', room.groupId)

    const result = await postAgentText({
      hash: hashToken(tok('locked')),
      groupId: room.groupId,
      text: 'hi',
    })

    await db.from('groups').update({ is_locked: false }).eq('id', room.groupId)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('locked')
  })

  it('rejects text over 1000 characters', async () => {
    const { postAgentText } = await import('../lib/agent/post')
    const result = await postAgentText({
      hash: hashToken(tok('long')),
      groupId: room.groupId,
      text: 'x'.repeat(1001),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })

  it('does not consume quota when validation fails', async () => {
    const { postAgentText } = await import('../lib/agent/post')
    const token = tok('quota-invalid')
    const hash = hashToken(token)
    await db.from('rate_events').delete().eq('author_token_hash', hash)

    const result = await postAgentText({
      hash,
      groupId: room.groupId,
      text: 'x'.repeat(1001),
    })

    const { count } = await db
      .from('rate_events')
      .select('*', { count: 'exact', head: true })
      .eq('author_token_hash', hash)

    expect(result.ok).toBe(false)
    expect(count).toBe(0)
  })

  it('allows 5 in 10 seconds and rejects the 6th with a retryAfter', async () => {
    const { postAgentText } = await import('../lib/agent/post')
    const token = tok('flood')
    await db.from('rate_events').delete().eq('author_token_hash', hashToken(token))

    const codes: (string | undefined)[] = []
    let limited: { retryAfter?: number } | null = null

    for (let i = 0; i < 6; i++) {
      const result = await postAgentText({
        hash: hashToken(token),
        groupId: room.groupId,
        text: `msg ${i}`,
      })
      codes.push(result.ok ? undefined : result.code)
      if (!result.ok && result.code === 'rate_limited') limited = result
    }

    expect(codes.slice(0, 5)).toEqual([undefined, undefined, undefined, undefined, undefined])
    expect(codes[5]).toBe('rate_limited')
    expect(limited!.retryAfter).toBeGreaterThan(0)
    expect(limited!.retryAfter!).toBeLessThanOrEqual(10)
  }, 45_000)

  it('rejects a malformed reply_to_id', async () => {
    const { postAgentText } = await import('../lib/agent/post')
    const result = await postAgentText({
      hash: hashToken(tok('bad-reply')),
      groupId: room.groupId,
      text: 'reply',
      replyToId: 'not-a-uuid',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })

  it('rejects a reply_to_id that lives in another room', async () => {
    const { postAgentText } = await import('../lib/agent/post')
    const { data: foreign } = await db
      .from('messages')
      .insert({
        group_id: otherRoom.groupId,
        kind: 'text',
        body: 'other room',
        author_token_hash: hashToken(tok('foreign')),
        author_name: 'Foreign001',
        author_color: '#2C5F8F',
      })
      .select('id')
      .single()

    const result = await postAgentText({
      hash: hashToken(tok('cross-reply')),
      groupId: room.groupId,
      text: 'reply',
      replyToId: foreign!.id,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })

  it('never sets admin_id, even while a live admin session exists', async () => {
    const { postAgentText } = await import('../lib/agent/post')

    const { data: admin } = await db
      .from('admins')
      .insert({ display_name: 'Agent Test Admin', role: 'co_admin', secret_hash: 'x' })
      .select('id')
      .single()

    const raw = `session-${RUN}-${Math.random().toString(36).slice(2)}`
    await db.from('admin_sessions').insert({
      token: createHash('sha256').update(raw).digest('hex'),
      admin_id: admin!.id,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    try {
      const result = await postAgentText({
        hash: hashToken(tok('admin-adjacent')),
        groupId: room.groupId,
        text: 'no badge please',
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const { data } = await db
        .from('messages')
        .select('admin_id')
        .eq('id', result.data.id)
        .single()

      expect(data!.admin_id).toBeNull()
    } finally {
      // Cascades to the session row.
      await db.from('admins').delete().eq('id', admin!.id)
    }
  })
})

describe('postAgentCode', () => {
  it('stores the code body untouched, with language, title and lab tag', async () => {
    const { postAgentCode } = await import('../lib/agent/post')
    const body = '  int main() {\n    return 0;\n  }'

    const result = await postAgentCode({
      hash: hashToken(tok('code')),
      groupId: room.groupId,
      code: body,
      lang: 'c',
      title: 'Q2',
      labTag: 'Lab 4',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { data } = await db
      .from('messages')
      .select('kind, body, code_lang, code_title, lab_tag')
      .eq('id', result.data.id)
      .single()

    expect(data!.kind).toBe('code')
    expect(data!.body).toBe(body)
    expect(data!.code_lang).toBe('c')
    expect(data!.code_title).toBe('Q2')
    expect(data!.lab_tag).toBe('Lab 4')
  })

  it('rejects a language outside the allowed set', async () => {
    const { postAgentCode } = await import('../lib/agent/post')
    const result = await postAgentCode({
      hash: hashToken(tok('code-rust')),
      groupId: room.groupId,
      code: 'fn main() {}',
      lang: 'rust',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })

  it('rejects code over 50000 characters', async () => {
    const { postAgentCode } = await import('../lib/agent/post')
    const result = await postAgentCode({
      hash: hashToken(tok('code-long')),
      groupId: room.groupId,
      code: 'x'.repeat(50_001),
      lang: 'c',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })
})
