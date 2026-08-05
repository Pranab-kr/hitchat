// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { ActionResult } from '@/lib/result'

// Same shape as tests/admin-auth.test.ts: next/headers is mocked because cookies()
// throws outside a request scope, and everything below it is real — real admin rows,
// real sessions, real Postgres. The plan mocks @/lib/auth/session instead, which would
// test requireOwner against a stub of itself rather than against a real session.
const mocks = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
}))

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

const structure = await import('@/app/actions/structure')
const admins = await import('@/app/actions/admins')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const COOKIE = 'hitchat_admin'
const sha = (v: string) => createHash('sha256').update(v).digest('hex')
const RUN = randomBytes(4).toString('hex')

let ownerId: string
let coAdminId: string

// Every row any test creates is registered here the moment it exists, so a failing
// assertion cannot skip its own cleanup and leak onto the live database. This is the
// Task 10 lesson; the plan's version cleans up inline after its assertions.
const extraAdminIds: string[] = []
const deptIds: string[] = []

async function makeAdmin(name: string, role: 'owner' | 'co_admin'): Promise<string> {
  const { data, error } = await db
    .from('admins')
    .insert({
      display_name: name,
      role,
      // Cost 10, not the production 12: these secrets are never authenticated against,
      // and cost 12 on every seed makes the suite noticeably slower.
      secret_hash: await bcrypt.hash(`secret-${RUN}`, 10),
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Could not seed admin ${name}: ${error?.message}`)
  extraAdminIds.push(data.id)
  return data.id
}

// Mints a real session row and puts its raw token in the mocked cookie jar, exactly as
// createSession would. signInAs(null) signs out.
async function signInAs(adminId: string | null) {
  mocks.cookies.clear()
  if (!adminId) return

  const raw = randomBytes(32).toString('hex')
  const { error } = await db.from('admin_sessions').insert({
    token: sha(raw),
    admin_id: adminId,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  })
  if (error) throw new Error(`Could not seed session: ${error.message}`)
  mocks.cookies.set(COOKIE, raw)
}

beforeAll(async () => {
  ownerId = await makeAdmin(`Test Owner ${RUN}`, 'owner')
  coAdminId = await makeAdmin(`Test Co ${RUN}`, 'co_admin')
})

beforeEach(() => {
  mocks.cookies.clear()
})

afterAll(async () => {
  for (const id of deptIds) await db.from('departments').delete().eq('id', id)
  for (const id of extraAdminIds) {
    await db.from('admin_sessions').delete().eq('admin_id', id)
    await db.from('admins').delete().eq('id', id)
  }
})

describe('owner-only actions reject a co-admin session', () => {
  // The single most important assertion in this file: a co-admin is a real,
  // fully-authenticated admin. Only the role check stands between them and the
  // structure of every room in the app.
  it('rejects every structure change', async () => {
    await signInAs(coAdminId)

    const calls: Array<() => Promise<ActionResult<unknown>>> = [
      () => structure.createDepartment({ name: 'X', slug: `xx-${RUN}` }),
      () => structure.createYear({ departmentId: crypto.randomUUID(), number: 1 }),
      () => structure.createBatch({ yearId: crypto.randomUUID(), number: 1 }),
      () => structure.createGroup({ batchId: crypto.randomUUID(), label: 'A' }),
      () => structure.deleteDepartment({ id: crypto.randomUUID(), confirmName: 'X' }),
    ]

    for (const call of calls) {
      const result = await call()
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.code).toBe('unauthorized')
      expect(result.message).toBe('Only the owner can do that.')
    }

    // The refusal must be a refusal, not a failed write reported as one.
    const { count } = await db
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .eq('slug', `xx-${RUN}`)
    expect(count).toBe(0)
  })

  it('rejects admin management', async () => {
    await signInAs(coAdminId)

    const created = await admins.createCoAdmin(`Sneaky ${RUN}`)
    expect(created.ok).toBe(false)

    const revoked = await admins.revokeAdmin(ownerId)
    expect(revoked.ok).toBe(false)

    const listed = await admins.listAdmins()
    expect(listed.ok).toBe(false)

    // No admin row was created, and the owner was not revoked.
    const { count } = await db
      .from('admins')
      .select('id', { count: 'exact', head: true })
      .eq('display_name', `Sneaky ${RUN}`)
    expect(count).toBe(0)

    const { data: owner } = await db
      .from('admins')
      .select('revoked_at')
      .eq('id', ownerId)
      .single()
    expect(owner!.revoked_at).toBeNull()
  })

  it('rejects everything when no session exists', async () => {
    await signInAs(null)

    const result = await structure.createDepartment({ name: 'X', slug: `nn-${RUN}` })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('unauthorized')
  })

  it('rejects a revoked owner', async () => {
    const tempOwner = await makeAdmin(`Temp Owner ${RUN}`, 'owner')
    await signInAs(tempOwner)

    // Authorized right up until the moment the row is revoked.
    expect((await admins.listAdmins()).ok).toBe(true)

    await db
      .from('admins')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', tempOwner)

    // Same cookie, same session row — the revocation alone must close the door.
    expect((await admins.listAdmins()).ok).toBe(false)
  })
})

describe('createDepartment', () => {
  it('creates one and rejects a duplicate slug', async () => {
    await signInAs(ownerId)

    const slug = `dept-${RUN}`
    const first = await structure.createDepartment({ name: 'Computer Science', slug })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    deptIds.push(first.data.id)

    const second = await structure.createDepartment({ name: 'Duplicate', slug })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.message).toBe('That short name is already taken.')
  })

  it('rejects a malformed or reserved slug', async () => {
    await signInAs(ownerId)

    // 'UPPER' is deliberately absent: the slug is lowercased before validation, the
    // same way createGroup uppercases its label. See the normalization test below.
    for (const slug of ['A', 'has space', 'x', 'under_score', 'sudo', 'c', 'a'.repeat(21)]) {
      const result = await structure.createDepartment({ name: 'Nope', slug })
      expect(result.ok, `slug ${JSON.stringify(slug)} should be refused`).toBe(false)
    }

    // Nothing above may have written a row. Checked by name because a refused insert
    // has no id to look up.
    const { count } = await db
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .eq('name', 'Nope')
    expect(count).toBe(0)
  })

  it('lowercases and trims the slug rather than refusing it', async () => {
    await signInAs(ownerId)

    const result = await structure.createDepartment({
      name: `Shouty ${RUN}`,
      slug: `  MECH-${RUN.toUpperCase()}  `,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    deptIds.push(result.data.id)

    // The room URL /c/[dept] is matched against the stored slug verbatim, so a slug
    // that kept its uppercase would be a department nobody could reach.
    const { data } = await db
      .from('departments')
      .select('slug')
      .eq('id', result.data.id)
      .single()
    expect(data!.slug).toBe(`mech-${RUN.toLowerCase()}`)
  })
})

describe('the structure tree', () => {
  it('builds department → year → batch → group and cascades on delete', async () => {
    await signInAs(ownerId)

    const dept = await structure.createDepartment({
      name: `Tree ${RUN}`,
      slug: `tree-${RUN}`,
    })
    expect(dept.ok).toBe(true)
    if (!dept.ok) return
    deptIds.push(dept.data.id)

    const year = await structure.createYear({ departmentId: dept.data.id, number: 3 })
    expect(year.ok).toBe(true)
    if (!year.ok) return

    const batch = await structure.createBatch({ yearId: year.data.id, number: 2 })
    expect(batch.ok).toBe(true)
    if (!batch.ok) return

    // Lowercase in, uppercase stored: the room page looks groups up by the uppercased
    // URL segment, so a lowercase row would be a room nobody could open.
    const group = await structure.createGroup({ batchId: batch.data.id, label: 'a' })
    expect(group.ok).toBe(true)
    if (!group.ok) return

    const { data: row } = await db
      .from('groups')
      .select('label')
      .eq('id', group.data.id)
      .single()
    expect(row!.label).toBe('A')

    // Deleting the department must take the whole subtree with it.
    const deleted = await structure.deleteDepartment({
      id: dept.data.id,
      confirmName: `Tree ${RUN}`,
    })
    expect(deleted.ok).toBe(true)

    const { count: groups } = await db
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .eq('id', group.data.id)
    expect(groups).toBe(0)

    const { count: years } = await db
      .from('years')
      .select('id', { count: 'exact', head: true })
      .eq('id', year.data.id)
    expect(years).toBe(0)
  })

  it('rejects out-of-range years and batches', async () => {
    await signInAs(ownerId)

    for (const number of [0, 6, 1.5, Number.NaN]) {
      const result = await structure.createYear({
        departmentId: crypto.randomUUID(),
        number,
      })
      expect(result.ok, `year ${number} should be refused`).toBe(false)
    }

    for (const number of [0, 9, 2.5]) {
      const result = await structure.createBatch({ yearId: crypto.randomUUID(), number })
      expect(result.ok, `batch ${number} should be refused`).toBe(false)
    }
  })
})

describe('deleteDepartment', () => {
  it('refuses without an exact name match and leaves the department intact', async () => {
    await signInAs(ownerId)

    const name = `Fragile ${RUN}`
    const dept = await structure.createDepartment({ name, slug: `frag-${RUN}` })
    expect(dept.ok).toBe(true)
    if (!dept.ok) return
    deptIds.push(dept.data.id)

    for (const wrong of ['', 'Fragile', name.toLowerCase(), `${name} `]) {
      const result = await structure.deleteDepartment({
        id: dept.data.id,
        confirmName: wrong,
      })
      // A trailing space is trimmed and therefore matches; everything else must not.
      if (wrong === `${name} `) {
        expect(result.ok).toBe(true)
        continue
      }
      expect(result.ok, `${JSON.stringify(wrong)} should not confirm`).toBe(false)

      const { count } = await db
        .from('departments')
        .select('id', { count: 'exact', head: true })
        .eq('id', dept.data.id)
      expect(count).toBe(1)
    }
  })
})

describe('createCoAdmin', () => {
  it('returns a secret once and stores only its bcrypt hash', async () => {
    await signInAs(ownerId)

    const name = `Lab Assistant ${RUN}`
    const result = await admins.createCoAdmin(name)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.secret.length).toBeGreaterThan(12)

    const { data: row } = await db
      .from('admins')
      .select('id, secret_hash, role')
      .eq('display_name', name)
      .single()
    extraAdminIds.push(row!.id)

    expect(row!.role).toBe('co_admin')
    expect(row!.secret_hash).not.toContain(result.data.secret)
    expect(await bcrypt.compare(result.data.secret, row!.secret_hash)).toBe(true)

    // There is deliberately no read path back to the secret. listAdmins must not
    // become one by accident.
    const listed = await admins.listAdmins()
    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    expect(JSON.stringify(listed.data)).not.toContain(result.data.secret)
    expect(JSON.stringify(listed.data)).not.toContain('secret_hash')
  })

  it('generates a different secret every time', async () => {
    await signInAs(ownerId)

    const a = await admins.createCoAdmin(`Twin A ${RUN}`)
    const b = await admins.createCoAdmin(`Twin B ${RUN}`)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    for (const name of [`Twin A ${RUN}`, `Twin B ${RUN}`]) {
      const { data } = await db.from('admins').select('id').eq('display_name', name).single()
      if (data) extraAdminIds.push(data.id)
    }

    expect(a.data.secret).not.toBe(b.data.secret)
  })

  it('refuses a blank name', async () => {
    await signInAs(ownerId)
    const result = await admins.createCoAdmin('   ')
    expect(result.ok).toBe(false)
  })
})

describe('revokeAdmin', () => {
  it('refuses to revoke the owner', async () => {
    await signInAs(ownerId)

    const result = await admins.revokeAdmin(ownerId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('The owner cannot be revoked.')

    const { data } = await db.from('admins').select('revoked_at').eq('id', ownerId).single()
    expect(data!.revoked_at).toBeNull()
  })

  it('revokes a co-admin and deletes their live sessions', async () => {
    const victim = await makeAdmin(`Victim ${RUN}`, 'co_admin')

    // Give them a live session, the way a real signed-in co-admin would have.
    const raw = randomBytes(32).toString('hex')
    await db.from('admin_sessions').insert({
      token: sha(raw),
      admin_id: victim,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })

    await signInAs(ownerId)
    const result = await admins.revokeAdmin(victim)
    expect(result.ok).toBe(true)

    const { data: row } = await db
      .from('admins')
      .select('revoked_at')
      .eq('id', victim)
      .single()
    expect(row!.revoked_at).not.toBeNull()

    // Revoked is not enough on its own — the session rows must be gone, not merely
    // ignored, or a 7-day cookie keeps a row alive in the database for 7 days.
    const { count } = await db
      .from('admin_sessions')
      .select('token', { count: 'exact', head: true })
      .eq('admin_id', victim)
    expect(count).toBe(0)
  })

  it('is idempotent and reports an unknown id', async () => {
    await signInAs(ownerId)

    const victim = await makeAdmin(`Twice ${RUN}`, 'co_admin')
    expect((await admins.revokeAdmin(victim)).ok).toBe(true)
    expect((await admins.revokeAdmin(victim)).ok).toBe(true)

    const unknown = await admins.revokeAdmin(crypto.randomUUID())
    expect(unknown.ok).toBe(false)
  })
})
