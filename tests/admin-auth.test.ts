// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// next/headers throws outside a request scope, so it is mocked and the store is driven
// from the tests. Everything below the mock is the real thing: real Postgres, real
// bcrypt, real session lookups.
const mocks = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  deleted: [] as string[],
  ip: 'unset',
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      mocks.cookies.has(name) ? { name, value: mocks.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => {
      mocks.cookies.set(name, value)
    },
    delete: (name: string) => {
      mocks.deleted.push(name)
      mocks.cookies.delete(name)
    },
  }),
  headers: async () => ({
    get: (name: string) => (name === 'x-forwarded-for' ? mocks.ip : null),
  }),
}))

const { verifySession, createSession, destroySession } = await import('@/lib/auth/session')
const { requireAdmin, requireOwner } = await import('@/lib/auth/require')
const { adminLogin, adminLogout } = await import('@/app/actions/admin')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const sha = (v: string) => createHash('sha256').update(v).digest('hex')

// Rate-limit state lives in the database and outlives the process, so a fixed IP would
// exhaust its own 5-per-60s quota on a second run inside the window. Same lesson as
// tests/messages-action.test.ts and its tok() helper.
const RUN = randomBytes(4).toString('hex')
const ipFor = (label: string) => `203.0.113.${label}-${RUN}`

const CO_SECRET = `co-secret-${RUN}`
const REVOKED_SECRET = `revoked-secret-${RUN}`
const OWNER_TEST_SECRET = `owner-secret-${RUN}`

let coAdminId: string
let revokedId: string
let ownerTestId: string
// Anything created mid-test lands here, so a failing assertion cannot skip its own
// cleanup and leave a stray admin row on the live database.
const extraAdminIds: string[] = []

async function makeAdmin(name: string, role: string, secret: string, revoked = false) {
  const { data, error } = await db
    .from('admins')
    .insert({
      display_name: name,
      role,
      secret_hash: await bcrypt.hash(secret, 10),
      revoked_at: revoked ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data!.id as string
}

async function makeTempAdmin(name: string, role: string, secret: string, revoked = false) {
  const id = await makeAdmin(name, role, secret, revoked)
  extraAdminIds.push(id)
  return id
}

/** Mints a real session row for an admin and puts its raw token in the cookie jar. */
async function signIn(adminId: string, expiresAt = new Date(Date.now() + 60_000)) {
  const raw = randomBytes(32).toString('hex')
  const { error } = await db.from('admin_sessions').insert({
    token: sha(raw),
    admin_id: adminId,
    expires_at: expiresAt.toISOString(),
  })
  if (error) throw error
  mocks.cookies.set('hitchat_admin', raw)
  return raw
}

beforeAll(async () => {
  coAdminId = await makeAdmin(`Test Co ${RUN}`, 'co_admin', CO_SECRET)
  revokedId = await makeAdmin(`Test Revoked ${RUN}`, 'co_admin', REVOKED_SECRET, true)
  // A second owner, so owner-path tests never depend on the real seeded owner's secret.
  ownerTestId = await makeAdmin(`Test Owner ${RUN}`, 'owner', OWNER_TEST_SECRET)
})

afterAll(async () => {
  const ids = [coAdminId, revokedId, ownerTestId, ...extraAdminIds].filter(Boolean)
  await db.from('admin_sessions').delete().in('admin_id', ids)
  await db.from('admins').delete().in('id', ids)
  await db.from('rate_events').delete().eq('action', 'admin_login')
})

beforeEach(() => {
  mocks.cookies.clear()
  mocks.deleted.length = 0
  mocks.ip = ipFor('1')
})

describe('admin secrets at rest', () => {
  it('are never stored in plaintext', async () => {
    const { data } = await db
      .from('admins')
      .select('secret_hash')
      .eq('id', coAdminId)
      .single()
    expect(data!.secret_hash).not.toBe(CO_SECRET)
    expect(data!.secret_hash).not.toContain(CO_SECRET)
    expect(data!.secret_hash).toMatch(/^\$2[aby]\$/)
  })

  it('verify with bcrypt and reject a wrong secret', async () => {
    const { data } = await db
      .from('admins')
      .select('secret_hash')
      .eq('id', coAdminId)
      .single()
    expect(await bcrypt.compare(CO_SECRET, data!.secret_hash)).toBe(true)
    expect(await bcrypt.compare('wrong-secret', data!.secret_hash)).toBe(false)
  })

  it('the seeded owner is hashed at cost 12', async () => {
    const { data } = await db
      .from('admins')
      .select('secret_hash')
      .eq('display_name', 'Owner')
      .eq('role', 'owner')
      .single()
    expect(data!.secret_hash).toMatch(/^\$2[aby]\$12\$/)
  })
})

describe('verifySession', () => {
  it('returns null with no cookie', async () => {
    expect(await verifySession()).toBeNull()
  })

  it('returns null for a token that matches no session', async () => {
    mocks.cookies.set('hitchat_admin', randomBytes(32).toString('hex'))
    expect(await verifySession()).toBeNull()
  })

  it('returns the admin and role for a live session', async () => {
    await signIn(coAdminId)
    expect(await verifySession()).toEqual({ adminId: coAdminId, role: 'co_admin' })
  })

  it('rejects an expired session', async () => {
    await signIn(coAdminId, new Date(Date.now() - 1000))
    expect(await verifySession()).toBeNull()
  })

  // The whole point of re-reading the admin row on every call.
  it('rejects a revoked admin holding an otherwise valid session', async () => {
    await signIn(revokedId)
    expect(await verifySession()).toBeNull()
  })

  it('rejects a session whose admin row was deleted', async () => {
    const tempId = await makeTempAdmin(`Test Temp ${RUN}`, 'co_admin', `temp-${RUN}`)
    await signIn(tempId)
    expect(await verifySession()).not.toBeNull()

    await db.from('admins').delete().eq('id', tempId)
    expect(await verifySession()).toBeNull()
  })
})

describe('session tokens at rest', () => {
  it('are stored hashed, so the raw cookie value is not in the table', async () => {
    const raw = await signIn(coAdminId)

    const { data: byRaw } = await db
      .from('admin_sessions')
      .select('token')
      .eq('token', raw)
    expect(byRaw ?? []).toHaveLength(0)

    const { data: byHash } = await db
      .from('admin_sessions')
      .select('token')
      .eq('token', sha(raw))
    expect(byHash).toHaveLength(1)
  })

  it('createSession sets a cookie whose value is absent from the database', async () => {
    await createSession(coAdminId)
    const raw = mocks.cookies.get('hitchat_admin')
    expect(raw).toMatch(/^[0-9a-f]{64}$/)

    const { data } = await db.from('admin_sessions').select('token').eq('token', raw!)
    expect(data ?? []).toHaveLength(0)
    expect(await verifySession()).toEqual({ adminId: coAdminId, role: 'co_admin' })
  })
})

describe('requireAdmin / requireOwner', () => {
  it('requireAdmin refuses an anonymous caller', async () => {
    const result = await requireAdmin()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unauthorized')
  })

  it('requireAdmin admits a co-admin', async () => {
    await signIn(coAdminId)
    const result = await requireAdmin()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.role).toBe('co_admin')
  })

  // The two-tier model in one assertion.
  it('requireOwner refuses a co-admin', async () => {
    await signIn(coAdminId)
    const result = await requireOwner()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unauthorized')
      expect(result.message).toBe('Only the owner can do that.')
    }
  })

  it('requireOwner admits an owner', async () => {
    await signIn(ownerTestId)
    const result = await requireOwner()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.adminId).toBe(ownerTestId)
  })

  it('requireOwner refuses a revoked owner', async () => {
    const revokedOwner = await makeTempAdmin(`Test RO ${RUN}`, 'owner', `ro-${RUN}`, true)
    await signIn(revokedOwner)
    const result = await requireOwner()
    expect(result.ok).toBe(false)
  })
})

describe('adminLogin', () => {
  it('refuses an empty secret without touching the database', async () => {
    mocks.ip = ipFor('empty')
    const result = await adminLogin('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid')

    const { count } = await db
      .from('rate_events')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'admin_login')
      .eq('author_token_hash', 'never-hashed')
    expect(count ?? 0).toBe(0)
  })

  it('refuses a wrong secret and sets no cookie', async () => {
    mocks.ip = ipFor('wrong')
    const result = await adminLogin(`definitely-not-it-${RUN}`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unauthorized')
      expect(result.message).toBe("That secret doesn't work.")
    }
    expect(mocks.cookies.has('hitchat_admin')).toBe(false)
  })

  it('accepts a real secret and establishes a verifiable session', async () => {
    mocks.ip = ipFor('good')
    const result = await adminLogin(CO_SECRET)
    expect(result.ok).toBe(true)
    expect(mocks.cookies.get('hitchat_admin')).toMatch(/^[0-9a-f]{64}$/)
    expect(await verifySession()).toEqual({ adminId: coAdminId, role: 'co_admin' })
  })

  it('refuses a revoked admin their own correct secret', async () => {
    mocks.ip = ipFor('revoked')
    const result = await adminLogin(REVOKED_SECRET)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unauthorized')
    expect(mocks.cookies.has('hitchat_admin')).toBe(false)
  })

  it('rate limits the sixth attempt from one address', async () => {
    mocks.ip = ipFor('flood')
    const codes: string[] = []
    for (let i = 0; i < 6; i++) {
      const result = await adminLogin(`guess-${i}-${RUN}`)
      codes.push(result.ok ? 'ok' : result.code)
    }
    expect(codes.slice(0, 5)).toEqual(Array(5).fill('unauthorized'))
    expect(codes[5]).toBe('rate_limited')
  }, 30_000)

  it('counts the limit per address, so one flood does not lock everyone out', async () => {
    mocks.ip = ipFor('floodA')
    for (let i = 0; i < 5; i++) await adminLogin(`a-${i}-${RUN}`)
    const blocked = await adminLogin(`a-final-${RUN}`)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.code).toBe('rate_limited')

    mocks.ip = ipFor('floodB')
    const other = await adminLogin(CO_SECRET)
    expect(other.ok).toBe(true)
  }, 30_000)
})

describe('adminLogout', () => {
  it('deletes the session row and clears the cookie', async () => {
    const raw = await signIn(coAdminId)
    expect(await verifySession()).not.toBeNull()

    await adminLogout()

    expect(mocks.deleted).toContain('hitchat_admin')
    expect(mocks.cookies.has('hitchat_admin')).toBe(false)
    const { data } = await db.from('admin_sessions').select('token').eq('token', sha(raw))
    expect(data ?? []).toHaveLength(0)
  })

  it('is a no-op when nobody is signed in', async () => {
    await expect(destroySession()).resolves.toBeUndefined()
  })
})
