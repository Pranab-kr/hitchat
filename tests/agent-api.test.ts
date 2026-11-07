// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testDb as db, seedRoom, teardownRoom, type SeededRoom } from './helpers/seed-room'
import { hashToken } from '../lib/identity'
import { GET as getRooms } from '../app/api/agent/rooms/route'
import { GET as getMessages, POST as postMessages } from '../app/api/agent/messages/route'
import { POST as postCode } from '../app/api/agent/code/route'

let room: SeededRoom
let otherRoom: SeededRoom

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const tokens: string[] = []

function tok(name: string): string {
  const value = `${name}-${RUN}`
  tokens.push(value)
  return value
}

const roomPath = () => `${room.deptSlug}/1/1/A`

function req(
  path: string,
  init: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...init.headers }
  if (init.token) headers.Authorization = `Bearer ${init.token}`

  let body: string | undefined
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body)
  }

  return new Request(`http://localhost:3000${path}`, {
    method: init.method ?? 'GET',
    headers,
    body,
  })
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

describe('GET /api/agent/rooms', () => {
  it('returns the seeded room', async () => {
    const res = await getRooms(req('/api/agent/rooms', { token: tok('rooms') }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: roomPath(), locked: false }),
      ]),
    )
  })

  it('returns 401 without a token', async () => {
    const res = await getRooms(req('/api/agent/rooms'))
    expect(res.status).toBe(401)
  })

  it('returns 401 for a malformed token', async () => {
    const res = await getRooms(req('/api/agent/rooms', { token: 'too-short' }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/agent/messages', () => {
  it('sends a text and returns id, room and url', async () => {
    const res = await postMessages(
      req('/api/agent/messages', {
        method: 'POST',
        token: tok('send'),
        body: { room: roomPath(), text: 'hello from the API' },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.id).toBeTruthy()
    expect(body.data.room).toBe(roomPath())
    expect(body.data.url).toBe(`http://localhost:3000/c/${room.deptSlug}/1/1/a`)
    expect(new Date(body.data.expires_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('accepts a lowercase room path', async () => {
    const res = await postMessages(
      req('/api/agent/messages', {
        method: 'POST',
        token: tok('lowercase'),
        body: { room: roomPath().toLowerCase(), text: 'lowercase works' },
      }),
    )

    expect(res.status).toBe(200)
  })

  it('returns 400 for malformed JSON', async () => {
    const res = await postMessages(
      req('/api/agent/messages', { method: 'POST', token: tok('bad-json'), body: '{' }),
    )

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('invalid')
  })

  it('returns 400 for a missing text', async () => {
    const res = await postMessages(
      req('/api/agent/messages', {
        method: 'POST',
        token: tok('no-text'),
        body: { room: roomPath() },
      }),
    )

    expect(res.status).toBe(400)
  })

  it('returns 403 on a locked room', async () => {
    await db.from('groups').update({ is_locked: true }).eq('id', room.groupId)

    const res = await postMessages(
      req('/api/agent/messages', {
        method: 'POST',
        token: tok('locked'),
        body: { room: roomPath(), text: 'hi' },
      }),
    )

    await db.from('groups').update({ is_locked: false }).eq('id', room.groupId)

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('locked')
  })

  it('returns 403 for a banned token', async () => {
    const token = tok('banned')
    await db.from('bans').insert({
      author_token_hash: hashToken(token),
      until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    const res = await postMessages(
      req('/api/agent/messages', {
        method: 'POST',
        token,
        body: { room: roomPath(), text: 'let me in' },
      }),
    )

    await db.from('bans').delete().eq('author_token_hash', hashToken(token))

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('banned')
  })

  it('returns 429 with Retry-After on the sixth post', async () => {
    const token = tok('flood')
    await db.from('rate_events').delete().eq('author_token_hash', hashToken(token))

    let last: Response | undefined
    for (let i = 0; i < 6; i++) {
      last = await postMessages(
        req('/api/agent/messages', {
          method: 'POST',
          token,
          body: { room: roomPath(), text: `msg ${i}` },
        }),
      )
    }

    expect(last!.status).toBe(429)
    expect(last!.headers.get('Retry-After')).toBeTruthy()
    expect((await last!.json()).retryAfter).toBeGreaterThan(0)
  }, 45_000)

  it('returns 404 for an unknown room', async () => {
    const res = await postMessages(
      req('/api/agent/messages', {
        method: 'POST',
        token: tok('missing-room'),
        body: { room: 'no-such-dept/1/1/A', text: 'hi' },
      }),
    )

    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('not_found')
  })

  it('a valid admin cookie does not create a SUDO message', async () => {
    const { data: admin } = await db
      .from('admins')
      .insert({ display_name: 'API Test Admin', role: 'co_admin', secret_hash: 'x' })
      .select('id')
      .single()

    const raw = `session-${RUN}-${Math.random().toString(36).slice(2)}`
    await db.from('admin_sessions').insert({
      token: createHash('sha256').update(raw).digest('hex'),
      admin_id: admin!.id,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    try {
      const res = await postMessages(
        req('/api/agent/messages', {
          method: 'POST',
          token: tok('with-cookie'),
          headers: { Cookie: `hitchat_admin=${raw}` },
          body: { room: roomPath(), text: 'no badge' },
        }),
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      const { data } = await db
        .from('messages')
        .select('admin_id')
        .eq('id', body.data.id)
        .single()
      expect(data!.admin_id).toBeNull()
    } finally {
      await db.from('admins').delete().eq('id', admin!.id)
    }
  })

  it('a valid admin cookie does not unlock a locked room', async () => {
    const { data: admin } = await db
      .from('admins')
      .insert({ display_name: 'API Test Admin 2', role: 'co_admin', secret_hash: 'x' })
      .select('id')
      .single()

    const raw = `session-${RUN}-${Math.random().toString(36).slice(2)}`
    await db.from('admin_sessions').insert({
      token: createHash('sha256').update(raw).digest('hex'),
      admin_id: admin!.id,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    await db.from('groups').update({ is_locked: true }).eq('id', room.groupId)

    try {
      const res = await postMessages(
        req('/api/agent/messages', {
          method: 'POST',
          token: tok('locked-cookie'),
          headers: { Cookie: `hitchat_admin=${raw}` },
          body: { room: roomPath(), text: 'admin cookie' },
        }),
      )

      expect(res.status).toBe(403)
      expect((await res.json()).code).toBe('locked')
    } finally {
      await db.from('groups').update({ is_locked: false }).eq('id', room.groupId)
      await db.from('admins').delete().eq('id', admin!.id)
    }
  })
})

describe('GET /api/agent/messages', () => {
  it('returns live messages and hides a deleted one', async () => {
    await db.from('messages').insert([
      {
        group_id: otherRoom.groupId,
        kind: 'text',
        body: 'live one',
        author_token_hash: hashToken(tok('read-seed')),
        author_name: 'ReadSeed001',
        author_color: '#2C5F8F',
      },
      {
        group_id: otherRoom.groupId,
        kind: 'text',
        body: '',
        deleted_at: new Date().toISOString(),
        author_token_hash: hashToken(tok('read-seed')),
        author_name: 'ReadSeed001',
        author_color: '#2C5F8F',
      },
    ])

    const res = await getMessages(
      req(`/api/agent/messages?room=${otherRoom.deptSlug}/1/1/A`, { token: tok('read') }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.messages.map((m: { body: string }) => m.body)).toEqual(['live one'])
  })

  it('returns 400 without a room query', async () => {
    const res = await getMessages(req('/api/agent/messages', { token: tok('read-noroom') }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a non-integer limit', async () => {
    const res = await getMessages(
      req(`/api/agent/messages?room=${roomPath()}&limit=abc`, { token: tok('read-badlimit') }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown room', async () => {
    const res = await getMessages(
      req('/api/agent/messages?room=no-such-dept/1/1/A', { token: tok('read-missing') }),
    )

    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('not_found')
  })
})

describe('POST /api/agent/code', () => {
  it('sends a code post', async () => {
    const res = await postCode(
      req('/api/agent/code', {
        method: 'POST',
        token: tok('code'),
        body: { room: roomPath(), code: 'print(1)', lang: 'python', lab_tag: 'Lab 3' },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.url).toContain('/c/')
  })

  it('returns 400 for a disallowed language', async () => {
    const res = await postCode(
      req('/api/agent/code', {
        method: 'POST',
        token: tok('code-rust'),
        body: { room: roomPath(), code: 'fn main() {}', lang: 'rust' },
      }),
    )

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('invalid')
  })
})
