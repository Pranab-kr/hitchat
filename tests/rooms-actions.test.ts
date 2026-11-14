// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Same shape as tests/owner-actions.test.ts: next/headers is mocked because cookies()
// throws outside a request scope, and everything below it is real — real admin rows,
// real sessions, a real tree in Postgres. Room creation and room deletion are the whole
// subject here, so nothing about the guards is stubbed.
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

const rooms = await import('@/app/actions/rooms')
const { hashToken } = await import('@/lib/identity')
const { testDb } = await import('./helpers/seed-room')

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
let deptId: string
let batchId: string

const extraAdminIds: string[] = []
// Every anonymous identity a test mints is registered here so the rate_events rows it
// leaves behind are swept even when an assertion fails first.
const tokenHashes: string[] = []

function mintToken(): { token: string; hash: string } {
  const token = randomUUID()
  const hash = hashToken(token)
  tokenHashes.push(hash)
  return { token, hash }
}

async function makeAdmin(name: string, role: 'owner' | 'co_admin'): Promise<string> {
  const { data, error } = await db
    .from('admins')
    .insert({
      display_name: name,
      role,
      // Cost 10: these secrets are never authenticated against, and cost 12 on every
      // seed makes the suite noticeably slower.
      secret_hash: await bcrypt.hash(`secret-${RUN}`, 10),
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Could not seed admin ${name}: ${error?.message}`)
  extraAdminIds.push(data.id)
  return data.id
}

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

async function ownershipOf(groupId: string) {
  const { data } = await db
    .from('groups')
    .select('created_by_admin_id, created_by_hash')
    .eq('id', groupId)
    .single()
  return data!
}

async function roomExists(groupId: string): Promise<boolean> {
  const { count } = await db
    .from('groups')
    .select('id', { count: 'exact', head: true })
    .eq('id', groupId)
  return (count ?? 0) === 1
}

beforeAll(async () => {
  ownerId = await makeAdmin(`Room Owner ${RUN}`, 'owner')
  coAdminId = await makeAdmin(`Room Co ${RUN}`, 'co_admin')

  // One seeded department → year → batch that every case below adds rooms to. Deleting
  // the department in afterAll cascades the whole subtree, rooms and messages included.
  const { data: dept, error: deptError } = await db
    .from('departments')
    .insert({ name: `Rooms ${RUN}`, slug: `rooms-${RUN}` })
    .select('id')
    .single()
  if (deptError) throw new Error(`seed department: ${deptError.message}`)
  deptId = dept!.id

  const { data: year, error: yearError } = await db
    .from('years')
    .insert({ department_id: deptId, number: 1 })
    .select('id')
    .single()
  if (yearError) throw new Error(`seed year: ${yearError.message}`)

  const { data: batch, error: batchError } = await db
    .from('batches')
    .insert({ year_id: year!.id, number: 1 })
    .select('id')
    .single()
  if (batchError) throw new Error(`seed batch: ${batchError.message}`)
  batchId = batch!.id
})

beforeEach(() => {
  mocks.cookies.clear()
})

afterAll(async () => {
  await db.from('departments').delete().eq('id', deptId)
  for (const id of extraAdminIds) {
    await db.from('admin_sessions').delete().eq('admin_id', id)
    await db.from('admins').delete().eq('id', id)
  }
  if (tokenHashes.length) {
    await db.from('rate_events').delete().in('author_token_hash', tokenHashes)
  }
})

describe('creating a room is open to everyone', () => {
  it('creates a typed hierarchy and reuses it for a second room', async () => {
    const { token } = mintToken()

    const first = await rooms.createRoom({
      department: `Typed Dept ${RUN}`,
      year: 2,
      batch: 3,
      label: 'K',
      token,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = await rooms.createRoom({
      department: `typed dept ${RUN}`,
      year: 2,
      batch: 3,
      label: 'L',
      token,
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return

    const { data: structure } = await testDb
      .from('departments')
      .select('id, name, slug, years(id, number, batches(id, number, groups(id, label)))')
      .eq('slug', `typed-dept-${RUN}`)
      .single()

    expect(structure?.name).toBe(`Typed Dept ${RUN}`)
    expect(structure?.years).toHaveLength(1)
    expect(structure?.years[0].batches).toHaveLength(1)
    expect(structure?.years[0].batches[0].groups.map((group: { label: string }) => group.label).sort()).toEqual([
      'K',
      'L',
    ])
  })

  it('uses one anonymous room quota event for the whole typed submission', async () => {
    const { token, hash } = mintToken()

    const before = await testDb
      .from('rate_events')
      .select('id', { count: 'exact', head: true })
      .eq('author_token_hash', hash)
      .eq('action', 'room')

    const created = await rooms.createRoom({
      department: `Quota Dept ${RUN}`,
      year: 1,
      batch: 1,
      label: 'M',
      token,
    })
    expect(created.ok).toBe(true)

    const after = await testDb
      .from('rate_events')
      .select('id', { count: 'exact', head: true })
      .eq('author_token_hash', hash)
      .eq('action', 'room')

    expect((after.count ?? 0) - (before.count ?? 0)).toBe(1)
  })

  it('rejects invalid typed input before creating a department', async () => {
    const { token } = mintToken()

    const created = await rooms.createRoom({
      department: 'bad department!',
      year: 0,
      batch: 9,
      label: 'A1',
      token,
    })

    expect(created.ok).toBe(false)
    const { count } = await testDb
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .eq('name', 'bad department!')
    expect(count).toBe(0)
  })

  it('records the creator hash for an anonymous creator, and never the token', async () => {
    const { token, hash } = mintToken()

    const created = await rooms.createGroup({ batchId, label: 'A', token })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const row = await ownershipOf(created.data.id)
    expect(row.created_by_hash).toBe(hash)
    expect(row.created_by_admin_id).toBeNull()
    // The raw token must not appear anywhere in the row it created.
    expect(JSON.stringify(row)).not.toContain(token)
  })

  it('records the admin id for a signed-in creator, with no hash', async () => {
    await signInAs(ownerId)

    const created = await rooms.createGroup({ batchId, label: 'B' })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const row = await ownershipOf(created.data.id)
    expect(row.created_by_admin_id).toBe(ownerId)
    expect(row.created_by_hash).toBeNull()
  })

  it('refuses a write with neither a session nor a token', async () => {
    await signInAs(null)

    const created = await rooms.createGroup({ batchId, label: 'C' })
    expect(created.ok).toBe(false)
    if (created.ok) return
    expect(created.code).toBe('unauthorized')

    const { count } = await db
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('label', 'C')
    expect(count).toBe(0)
  })

  it('refuses a duplicate room and a malformed label', async () => {
    await signInAs(ownerId)

    const first = await rooms.createGroup({ batchId, label: 'AA' })
    expect(first.ok).toBe(true)

    const duplicate = await rooms.createGroup({ batchId, label: 'aa' })
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) expect(duplicate.message).toBe('That room already exists.')

    for (const label of ['', 'lab four', 'ABCD', 'A1']) {
      const result = await rooms.createGroup({ batchId, label })
      expect(result.ok, `label ${JSON.stringify(label)} should be refused`).toBe(false)
    }

    const { count } = await db
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('label', 'LAB FOUR')
    expect(count).toBe(0)
  })
})

describe('deleting a room follows creator ownership', () => {
  async function seedRoom(label: string, owner: 'anon' | 'co_admin' | 'none') {
    if (owner === 'anon') {
      const minted = mintToken()
      const created = await rooms.createGroup({ batchId, label, token: minted.token })
      if (!created.ok) throw new Error(`seed room ${label}: ${created.message}`)
      return { id: created.data.id, token: minted.token }
    }

    if (owner === 'co_admin') {
      await signInAs(coAdminId)
      const created = await rooms.createGroup({ batchId, label })
      await signInAs(null)
      if (!created.ok) throw new Error(`seed room ${label}: ${created.message}`)
      return { id: created.data.id, token: undefined }
    }

    // A room that predates ownership, exactly like the ones already on the live database.
    const { data, error } = await db
      .from('groups')
      .insert({ batch_id: batchId, label })
      .select('id')
      .single()
    if (error) throw new Error(`seed legacy room ${label}: ${error.message}`)
    return { id: data!.id, token: undefined }
  }

  it('lets the owner delete any room, whoever made it', async () => {
    const made = await seedRoom('D', 'anon')
    await signInAs(ownerId)

    const deleted = await rooms.deleteRoom({ groupId: made.id })
    expect(deleted.ok).toBe(true)
    expect(await roomExists(made.id)).toBe(false)
  })

  it('lets a co-admin delete only the room they created', async () => {
    const theirs = await seedRoom('E', 'co_admin')
    const someoneElses = await seedRoom('F', 'anon')

    await signInAs(coAdminId)

    const refused = await rooms.deleteRoom({ groupId: someoneElses.id })
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.code).toBe('unauthorized')
    expect(await roomExists(someoneElses.id)).toBe(true)

    const deleted = await rooms.deleteRoom({ groupId: theirs.id })
    expect(deleted.ok).toBe(true)
    expect(await roomExists(theirs.id)).toBe(false)
  })

  it('lets an anonymous creator delete only their own room', async () => {
    const mine = await seedRoom('G', 'anon')
    const other = await seedRoom('H', 'anon')
    const otherToken = mintToken().token

    const refused = await rooms.deleteRoom({ groupId: mine.id, token: otherToken })
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.code).toBe('unauthorized')
    expect(await roomExists(mine.id)).toBe(true)

    const deleted = await rooms.deleteRoom({ groupId: mine.id, token: mine.token })
    expect(deleted.ok).toBe(true)
    expect(await roomExists(mine.id)).toBe(false)

    // The other room is untouched by a delete aimed at a different id.
    expect(await roomExists(other.id)).toBe(true)
  })

  it('removes empty batch, year and department after deleting the last room', async () => {
    const { token } = mintToken()
    const { data: department } = await db
      .from('departments')
      .insert({ name: `Cleanup ${RUN}`, slug: `cleanup-${RUN}` })
      .select('id')
      .single()
    const { data: year } = await db
      .from('years')
      .insert({ department_id: department!.id, number: 1 })
      .select('id')
      .single()
    const { data: batch } = await db
      .from('batches')
      .insert({ year_id: year!.id, number: 1 })
      .select('id')
      .single()
    const made = await rooms.createGroup({ batchId: batch!.id, label: 'K', token })
    expect(made.ok).toBe(true)
    if (!made.ok) return

    const deleted = await rooms.deleteRoom({ groupId: made.data.id, token })
    expect(deleted.ok).toBe(true)

    const { count: departments } = await db
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .eq('id', department!.id)
    const { count: years } = await db
      .from('years')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', department!.id)
    expect(departments).toBe(0)
    expect(years).toBe(0)
  })

  it('leaves a room with no recorded creator to the owner alone', async () => {
    const legacy = await seedRoom('I', 'none')
    const { token } = mintToken()

    expect((await rooms.deleteRoom({ groupId: legacy.id, token })).ok).toBe(false)
    await signInAs(coAdminId)
    expect((await rooms.deleteRoom({ groupId: legacy.id })).ok).toBe(false)
    expect(await roomExists(legacy.id)).toBe(true)

    await signInAs(ownerId)
    expect((await rooms.deleteRoom({ groupId: legacy.id })).ok).toBe(true)
  })

  it('reports the same verdict the delete enforces', async () => {
    const mine = await seedRoom('J', 'anon')
    const { token: strangerToken } = mintToken()

    const own = await rooms.canDeleteRoom({ groupId: mine.id, token: mine.token })
    expect(own.ok && own.data.canDelete).toBe(true)

    const stranger = await rooms.canDeleteRoom({ groupId: mine.id, token: strangerToken })
    expect(stranger.ok && stranger.data.canDelete).toBe(false)

    // Same question through the admin path: the creator is anonymous, so neither a
    // co-admin nor an owner-less session may claim it.
    await signInAs(coAdminId)
    const coAdmin = await rooms.canDeleteRoom({ groupId: mine.id })
    expect(coAdmin.ok && coAdmin.data.canDelete).toBe(false)

    await signInAs(ownerId)
    const owner = await rooms.canDeleteRoom({ groupId: mine.id })
    expect(owner.ok && owner.data.canDelete).toBe(true)
  })
})

describe('anonymous room creation is rate limited', () => {
  it('refuses the 21st write in an hour, counting writes that fail afterwards', async () => {
    const { token } = mintToken()

    // A room to collide with, made by an admin so it costs the anonymous bucket nothing.
    await signInAs(ownerId)
    expect((await rooms.createGroup({ batchId, label: 'Z' })).ok).toBe(true)
    await signInAs(null)

    // 'Z' already exists, so each of these is refused as a duplicate *after* paying for
    // the rate check — the same order the message path uses.
    for (let i = 0; i < 20; i += 1) {
      const attempt = await rooms.createGroup({ batchId, label: 'Z', token })
      expect(attempt.ok).toBe(false)
      if (!attempt.ok) expect(attempt.code).toBe('invalid')
    }

    const limited = await rooms.createGroup({ batchId, label: 'Z', token })
    expect(limited.ok).toBe(false)
    if (limited.ok) return
    expect(limited.code).toBe('rate_limited')
    expect(limited.message).toContain('created enough rooms')
  })
})
