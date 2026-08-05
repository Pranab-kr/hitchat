import 'server-only'
import { cookies } from 'next/headers'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getServiceClient } from '@/lib/supabase/admin'

const COOKIE = 'hitchat_admin'
const DAYS_7 = 7 * 24 * 60 * 60

export type AdminRole = 'owner' | 'co_admin'
export type AdminSession = { adminId: string; role: AdminRole }

function hashSessionToken(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function createSession(adminId: string): Promise<void> {
  const raw = randomBytes(32).toString('hex')
  const db = getServiceClient()

  const { error } = await db.from('admin_sessions').insert({
    token: hashSessionToken(raw),
    admin_id: adminId,
    expires_at: new Date(Date.now() + DAYS_7 * 1000).toISOString(),
  })

  // Setting the cookie after a failed insert hands out a cookie no session backs,
  // which reads to the user as a successful login that silently does nothing.
  if (error) throw new Error('Could not create the session')

  // .set() is legal only in a Server Action or Route Handler in Next 16.
  const store = await cookies()
  store.set(COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DAYS_7,
  })
}

export async function verifySession(): Promise<AdminSession | null> {
  const store = await cookies()
  const raw = store.get(COOKIE)?.value
  if (!raw) return null

  const db = getServiceClient()
  const { data } = await db
    .from('admin_sessions')
    .select('token, admin_id, expires_at, admins!inner(role, revoked_at)')
    .eq('token', hashSessionToken(raw))
    .maybeSingle()

  if (!data) return null

  // The lookup above already matched on the hash, so this compares equal values by
  // construction. It is here so the comparison is constant-time regardless of what a
  // future change to the query does — an early-exit compare on a session token leaks
  // its prefix one byte at a time.
  const expected = Buffer.from(hashSessionToken(raw), 'hex')
  const stored = Buffer.from(data.token, 'hex')
  if (stored.length !== expected.length) return null
  if (!timingSafeEqual(stored, expected)) return null

  if (new Date(data.expires_at).getTime() < Date.now()) return null

  // Re-read on every call rather than trusted from the cookie: a revoked co-admin must
  // lose access immediately, not whenever their cookie happens to expire.
  const admin = data.admins as unknown as { role: AdminRole; revoked_at: string | null }
  if (admin.revoked_at) return null

  return { adminId: data.admin_id, role: admin.role }
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const raw = store.get(COOKIE)?.value

  if (raw) {
    const db = getServiceClient()
    await db.from('admin_sessions').delete().eq('token', hashSessionToken(raw))
  }

  store.delete(COOKIE)
}
