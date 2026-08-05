import 'server-only'
import { verifySession, type AdminRole } from '@/lib/auth/session'
import { type ActionResult, ok, err } from '@/lib/result'

// Deliberately NOT in app/actions/admin.ts. Every export of a 'use server' file is a
// callable HTTP endpoint, and a guard does not belong on the public surface. Task 11's
// moderation actions import these from here.

export async function requireAdmin(): Promise<
  ActionResult<{ adminId: string; role: AdminRole }>
> {
  const session = await verifySession()
  if (!session) return err('unauthorized', 'Sign in again.')
  return ok(session)
}

export async function requireOwner(): Promise<ActionResult<{ adminId: string }>> {
  const session = await verifySession()
  if (!session) return err('unauthorized', 'Sign in again.')
  if (session.role !== 'owner') {
    return err('unauthorized', 'Only the owner can do that.')
  }
  return ok({ adminId: session.adminId })
}
