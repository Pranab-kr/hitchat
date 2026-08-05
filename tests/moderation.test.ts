// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { seedRoom, teardownRoom, testDb as db, type SeededRoom } from './helpers/seed-room'

// next/headers throws outside a request scope, so the cookie jar is driven from the
// tests. Everything below it is real: real Postgres, real session rows, real guards.
// The plan mocked verifySession instead and returned adminId: 'test-admin' — not a
// UUID, so bans.created_by would fail its foreign key and the ban test could not run.
const mocks = vi.hoisted(() => ({ cookies: new Map<string, string>() }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      mocks.cookies.has(name) ? { name, value: mocks.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => {
      mocks.cookies.set(name, value)
    },
    delete: (name: string) => {
      mocks.cookies.delete(name)
    },
  }),
  headers: async () => ({ get: () => null }),
}))

const { adminDeleteMessage, togglePin, toggleLock, purgeRoom, banAuthor } = await import(
  '@/app/actions/moderation'
)
const { sendText } = await import('@/app/actions/messages')
const { hashToken } = await import('@/lib/identity')

const sha = (v: string) => createHash('sha256').update(v).digest('hex')

// Rate-limit and ban state live in the database and outlive the process, so a fixed
// token exhausts its own quota on a second run inside the window. Same lesson as
// tests/messages-action.test.ts.
const RUN = randomBytes(4).toString('hex')
const tok = (label: string) => `mod-${label}-${RUN}`

let room: SeededRoom
let adminId: string
const adminIds: string[] = []
// Every token that posts or gets banned, so afterAll can sweep bans and rate events
// even when an assertion fails partway through.
const usedTokens: string[] = []

async function post(token: string, body: string) {
  usedTokens.push(token)
  const result = await sendText({ token, groupId: room.groupId, body })
  if (!result.ok) throw new Error(`post failed: ${result.code} ${result.message}`)
  return result.data.id
}

/** Mints a real session row and puts its raw token in the cookie jar. */
async function signIn(id: string) {
  const raw = randomBytes(32).toString('hex')
  const { error } = await db.from('admin_sessions').insert({
    token: sha(raw),
    admin_id: id,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  })
  if (error) throw error
  mocks.cookies.set('hitchat_admin', raw)
}

async function messageRow(id: string) {
  const { data } = await db
    .from('messages')
    .select('body, code_lang, code_title, lab_tag, is_pinned, deleted_at')
    .eq('id', id)
    .single()
  return data!
}

beforeAll(async () => {
  room = await seedRoom()

  const { data, error } = await db
    .from('admins')
    .insert({
      display_name: `Test Mod ${RUN}`,
      role: 'co_admin',
      secret_hash: await bcrypt.hash(`mod-secret-${RUN}`, 10),
    })
    .select('id')
    .single()
  if (error) throw error
  adminId = data!.id
  adminIds.push(adminId)
})

afterAll(async () => {
  const hashes = usedTokens.map(hashToken)
  if (hashes.length) {
    await db.from('bans').delete().in('author_token_hash', hashes)
    await db.from('rate_events').delete().in('author_token_hash', hashes)
  }
  if (adminIds.length) {
    await db.from('admin_sessions').delete().in('admin_id', adminIds)
    await db.from('admins').delete().in('id', adminIds)
  }
  await teardownRoom(room)
})

beforeEach(() => {
  mocks.cookies.clear()
})

describe('moderation requires a valid admin session', () => {
  const NOWHERE = '00000000-0000-0000-0000-000000000000'

  it('refuses every action when no session exists', async () => {
    for (const [name, call] of [
      ['adminDeleteMessage', () => adminDeleteMessage(NOWHERE)],
      ['togglePin', () => togglePin(NOWHERE, true)],
      ['toggleLock', () => toggleLock(NOWHERE, true)],
      ['purgeRoom', () => purgeRoom(NOWHERE)],
      ['banAuthor', () => banAuthor(NOWHERE)],
    ] as const) {
      const result = await call()
      expect(result.ok, `${name} admitted an anonymous caller`).toBe(false)
      if (!result.ok) expect(result.code, name).toBe('unauthorized')
    }
  })

  // An expired cookie is the realistic case; a missing one is the trivial case.
  it('refuses an expired session, and changes nothing', async () => {
    await signIn(adminId)
    const id = await post(tok('expired'), 'still here')

    await db
      .from('admin_sessions')
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('token', sha(mocks.cookies.get('hitchat_admin')!))

    const result = await adminDeleteMessage(id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unauthorized')
    expect((await messageRow(id)).deleted_at).toBeNull()
  })

  it('refuses a revoked admin holding an otherwise valid session', async () => {
    const { data } = await db
      .from('admins')
      .insert({
        display_name: `Test Revoked Mod ${RUN}`,
        role: 'co_admin',
        secret_hash: await bcrypt.hash(`revoked-${RUN}`, 10),
        revoked_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    adminIds.push(data!.id)

    await signIn(data!.id)
    const result = await purgeRoom(room.groupId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unauthorized')
  })
})

describe('adminDeleteMessage', () => {
  it('soft-deletes and blanks the content, leaving the row for Realtime', async () => {
    await signIn(adminId)
    const id = await post(tok('del'), 'delete me')

    expect((await adminDeleteMessage(id)).ok).toBe(true)

    const row = await messageRow(id)
    expect(row.deleted_at).not.toBeNull()
    // The content must actually leave the database, not just be flagged.
    expect(row.body).toBe('')
    expect(row.code_lang).toBeNull()
    expect(row.code_title).toBeNull()
    expect(row.lab_tag).toBeNull()
  })

  it("deletes another person's message, unlike deleteOwnMessage", async () => {
    await signIn(adminId)
    const id = await post(tok('other'), 'not the admin')
    expect((await adminDeleteMessage(id)).ok).toBe(true)
    expect((await messageRow(id)).deleted_at).not.toBeNull()
  })
})

describe('togglePin', () => {
  it('pins and unpins', async () => {
    await signIn(adminId)
    const id = await post(tok('pin'), 'announcement')

    expect((await togglePin(id, true)).ok).toBe(true)
    expect((await messageRow(id)).is_pinned).toBe(true)

    expect((await togglePin(id, false)).ok).toBe(true)
    expect((await messageRow(id)).is_pinned).toBe(false)
  })

  // A pinned blank line in the strip with no way to unpin it from the stream.
  it('refuses to pin a deleted message', async () => {
    await signIn(adminId)
    const id = await post(tok('pindel'), 'gone')
    await adminDeleteMessage(id)

    await togglePin(id, true)
    expect((await messageRow(id)).is_pinned).toBe(false)
  })
})

describe('toggleLock', () => {
  it('locks the room so students cannot post, then unlocks it', async () => {
    await signIn(adminId)
    expect((await toggleLock(room.groupId, true)).ok).toBe(true)

    const blocked = await sendText({
      token: tok('locked'),
      groupId: room.groupId,
      body: 'let me in',
    })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.code).toBe('locked')

    expect((await toggleLock(room.groupId, false)).ok).toBe(true)
    await post(tok('unlocked'), 'back open')
  })
})

describe('purgeRoom', () => {
  it('blanks every live message and reports how many', async () => {
    await signIn(adminId)
    // Distinct tokens: text is capped at 5 per 60s per author.
    const ids = [
      await post(tok('purge1'), 'one'),
      await post(tok('purge2'), 'two'),
      await post(tok('purge3'), 'three'),
    ]

    const already = await post(tok('purge4'), 'already gone')
    await adminDeleteMessage(already)

    const result = await purgeRoom(room.groupId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Counts only what was actually purged. The pre-deleted message is excluded by
    // .is('deleted_at', null), so a second purge reports 0 rather than recounting.
    expect(result.data.count).toBeGreaterThanOrEqual(ids.length)

    for (const id of ids) {
      const row = await messageRow(id)
      expect(row.deleted_at).not.toBeNull()
      expect(row.body).toBe('')
    }

    const second = await purgeRoom(room.groupId)
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.data.count).toBe(0)
  }, 30_000)

  it('does not touch another room', async () => {
    const other = await seedRoom()
    try {
      await signIn(adminId)
      const survivor = await sendText({
        token: tok('otherroom'),
        groupId: other.groupId,
        body: 'different room',
      })
      expect(survivor.ok).toBe(true)
      if (!survivor.ok) return

      await purgeRoom(room.groupId)

      const row = await messageRow(survivor.data.id)
      expect(row.deleted_at).toBeNull()
      expect(row.body).toBe('different room')
    } finally {
      await teardownRoom(other)
    }
  })
})

describe('banAuthor', () => {
  it('blocks the banned author from posting again', async () => {
    await signIn(adminId)
    const token = tok('spammer')
    const id = await post(token, 'spam')

    expect((await banAuthor(id)).ok).toBe(true)

    const blocked = await sendText({ token, groupId: room.groupId, body: 'more spam' })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.code).toBe('banned')
  })

  it('derives the hash server-side and stores no raw token', async () => {
    await signIn(adminId)
    const token = tok('derive')
    const id = await post(token, 'hash me')
    await banAuthor(id)

    const { data } = await db
      .from('bans')
      .select('author_token_hash, until, created_by')
      .eq('author_token_hash', hashToken(token))
      .single()

    expect(data).not.toBeNull()
    expect(data!.author_token_hash).not.toBe(token)
    expect(data!.created_by).toBe(adminId)

    // 24 hours on purpose — deliberately independent of the 8-hour message lifetime.
    const hours = (new Date(data!.until).getTime() - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(23.5)
    expect(hours).toBeLessThan(24.5)
  })

  it('leaves a different author free to post', async () => {
    await signIn(adminId)
    const banned = tok('banned2')
    const id = await post(banned, 'spam again')
    await banAuthor(id)

    const other = await sendText({
      token: tok('bystander'),
      groupId: room.groupId,
      body: 'I did nothing',
    })
    usedTokens.push(tok('bystander'))
    expect(other.ok).toBe(true)
  })

  // Otherwise a co-admin bans the owner's browser by banning any SUDO message.
  it('refuses to ban an admin', async () => {
    await signIn(adminId)
    const token = tok('sudo')
    const id = await post(token, 'admin speaking')
    await db.from('messages').update({ admin_id: adminId }).eq('id', id)

    const result = await banAuthor(id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid')

    const { data } = await db
      .from('bans')
      .select('author_token_hash')
      .eq('author_token_hash', hashToken(token))
    expect(data ?? []).toHaveLength(0)
  })

  it('reports a message that no longer exists', async () => {
    await signIn(adminId)
    const result = await banAuthor('00000000-0000-0000-0000-000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid')
      expect(result.message).toBe('That message is already gone.')
    }
  })
})
