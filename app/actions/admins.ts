'use server'

import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { getServiceClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/lib/auth/require'
import { type ActionResult, ok, err } from '@/lib/result'
import { type AdminsState, type AdminSummary, emptyAdminsState } from '@/lib/owner-forms'

// Guards come from @/lib/auth/require, never from @/app/actions/admin.

export async function createCoAdmin(
  displayName: string,
): Promise<ActionResult<{ secret: string }>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  const name = displayName.trim()
  if (!name) return err('invalid', 'Give them a name you will recognise.')
  if (name.length > 40) return err('invalid', 'That name is too long. Keep it under 40 characters.')

  // Generated server-side so it is always strong — an owner-chosen secret would be the
  // weakest link in an otherwise bcrypt-cost-12 system. Shown once, never again.
  const secret = randomBytes(24).toString('base64url')

  const db = getServiceClient()
  const { error } = await db.from('admins').insert({
    display_name: name,
    role: 'co_admin',
    secret_hash: await bcrypt.hash(secret, 12),
  })

  if (error) return err('server', "Couldn't create that admin. Try again.")
  return ok({ secret })
}

export async function revokeAdmin(adminId: string): Promise<ActionResult<null>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  const db = getServiceClient()

  const { data: target } = await db
    .from('admins')
    .select('role, revoked_at')
    .eq('id', adminId)
    .maybeSingle()

  if (!target) return err('invalid', 'That admin is already gone.')
  // The owner is the only account that can create admins. Revoking it would leave the
  // app with no path back in short of editing the database by hand.
  if (target.role === 'owner') return err('invalid', 'The owner cannot be revoked.')
  if (target.revoked_at) return ok(null)

  const { error } = await db
    .from('admins')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', adminId)

  if (error) return err('server', "Couldn't revoke them. Try again.")

  // Kill their live sessions immediately rather than waiting for cookie expiry.
  // verifySession() also re-reads revoked_at on every call, so this is belt and braces —
  // but it means their rows leave the database now rather than in up to 7 days.
  await db.from('admin_sessions').delete().eq('admin_id', adminId)
  return ok(null)
}

// Read side for /sudo/admins. secret_hash is deliberately never selected — there is no
// path, even for the owner, that reads a secret back out.
export async function listAdmins(): Promise<ActionResult<AdminSummary[]>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  const db = getServiceClient()
  const { data, error } = await db
    .from('admins')
    .select('id, display_name, role, created_at, revoked_at')
    .order('created_at', { ascending: true })

  if (error) return err('server', "Couldn't load the admin list.")

  return ok(
    (data ?? []).map((a) => ({
      id: a.id,
      displayName: a.display_name,
      role: a.role as 'owner' | 'co_admin',
      createdAt: a.created_at,
      revokedAt: a.revoked_at,
    })),
  )
}

// ── Form-action wrappers ────────────────────────────────────────────────────────
// AdminsState and emptyAdminsState live in lib/owner-forms.ts — a 'use server' file may
// only export async functions, so a plain object exported from here throws at import
// time and 500s every form on the page.

export async function createCoAdminForm(
  _prev: AdminsState,
  form: FormData,
): Promise<AdminsState> {
  const raw = form.get('displayName')
  const name = typeof raw === 'string' ? raw.trim() : ''
  const result = await createCoAdmin(name)

  if (!result.ok) return { ...emptyAdminsState, error: result.message }
  return { error: null, notice: null, secret: result.data.secret, secretFor: name }
}

export async function revokeAdminForm(
  _prev: AdminsState,
  form: FormData,
): Promise<AdminsState> {
  const raw = form.get('adminId')
  const result = await revokeAdmin(typeof raw === 'string' ? raw : '')

  if (!result.ok) return { ...emptyAdminsState, error: result.message }
  // Any previously shown secret is dropped here on purpose: re-rendering the panel
  // after an unrelated action would put a one-time secret back on screen.
  return { ...emptyAdminsState, notice: 'Access revoked.' }
}
