'use server'

import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServiceClient } from '@/lib/supabase/admin'
import { createSession, destroySession } from '@/lib/auth/session'
import { hashToken } from '@/lib/identity'
import { assertRateOk } from '@/lib/guards'
import { type ActionResult, ok, err } from '@/lib/result'

// Peppered, never stored raw: rate_events would otherwise become a log of every IP
// that ever tried to sign in.
async function clientKey(): Promise<string> {
  const store = await headers()
  const cf = store.get('cf-connecting-ip')?.trim()
  const vercel = store.get('x-vercel-ip')?.trim()
  const realIp = store.get('x-real-ip')?.trim()
  const forwarded = store.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = cf || vercel || realIp || forwarded || 'unknown'
  return hashToken(`admin-login:${ip}`)
}

export async function adminLogin(secret: string): Promise<ActionResult<null>> {
  if (!secret) return err('invalid', 'Enter your secret.')

  // Checked before any bcrypt work. Without it this action is an unauthenticated
  // hashing oracle: one request costs a cost-12 compare against every live admin row.
  const rate = await assertRateOk(await clientKey(), 'admin_login')
  if (!rate.ok) return err('rate_limited', 'Too many attempts. Wait a minute.', 60)

  const db = getServiceClient()
  const { data: admins, error } = await db
    .from('admins')
    .select('id, secret_hash')
    .is('revoked_at', null)

  if (error) return err('server', 'Something went wrong. Try again.')

  // Every candidate is compared, with no early break, so the response time does not
  // reveal which row matched or how many rows were checked before it.
  let matched: string | null = null
  for (const admin of admins ?? []) {
    if (await bcrypt.compare(secret, admin.secret_hash)) {
      matched = admin.id
    }
  }

  if (!matched) return err('unauthorized', "That secret doesn't work.")

  try {
    await createSession(matched)
  } catch {
    return err('server', 'Could not sign you in. Try again.')
  }

  return ok(null)
}

export async function adminLogout(): Promise<void> {
  await destroySession()
}

export type LoginState = { error: string | null }

// Form-action wrapper so /sudo works with JavaScript disabled. The redirect lives here
// rather than in a client router.push, which never runs without JS.
export async function loginFormAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const secret = formData.get('secret')
  const result = await adminLogin(typeof secret === 'string' ? secret : '')

  // redirect() throws to unwind, so it must sit outside any try/catch.
  if (result.ok) redirect('/sudo')
  return { error: result.message }
}
