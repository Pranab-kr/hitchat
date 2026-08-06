'use server'

import { getServiceClient } from '@/lib/supabase/admin'
// NOT from '@/app/actions/admin': every export of a 'use server' file is a callable
// HTTP endpoint, and a guard does not belong on that surface.
import { requireAdmin } from '@/lib/auth/require'
import { type ActionResult, ok, err } from '@/lib/result'

// Blanking the content is the point of a soft delete: the row survives for Realtime to
// broadcast an UPDATE, but the message itself leaves the database immediately rather
// than merely being hidden behind a flag.
const REDACTED = {
  body: '',
  code_lang: null,
  code_title: null,
  lab_tag: null,
}

// Moderation is deliberately not peer-to-peer: the owner can moderate every message,
// while a co-admin cannot alter a SUDO post made by the owner. This reads both roles
// server-side; the client only ever gets presentation hints.
async function assertCanModerateMessage(
  messageId: string,
  role: 'owner' | 'co_admin',
): Promise<ActionResult<null>> {
  if (role === 'owner') return ok(null)

  const db = getServiceClient()
  const { data: message, error: messageError } = await db
    .from('messages')
    .select('admin_id')
    .eq('id', messageId)
    .maybeSingle()

  if (messageError) return err('server', 'Could not check that message. Try again.')
  // Preserve the idempotent delete/pin behavior for a message that has already gone.
  if (!message?.admin_id) return ok(null)

  const { data: author, error: authorError } = await db
    .from('admins')
    .select('role')
    .eq('id', message.admin_id)
    .maybeSingle()

  if (authorError) return err('server', 'Could not check that message. Try again.')
  if (author?.role === 'owner') {
    return err('invalid', "Co-admins can't moderate the owner's messages.")
  }

  return ok(null)
}

async function ownerAdminIds(): Promise<string[]> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('admins')
    .select('id')
    .eq('role', 'owner')
    .is('revoked_at', null)

  if (error) throw new Error('Could not load owner ids')
  return (data ?? []).map((admin) => admin.id)
}

export async function adminDeleteMessage(messageId: string): Promise<ActionResult<null>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const allowed = await assertCanModerateMessage(messageId, auth.data.role)
  if (!allowed.ok) return allowed

  const db = getServiceClient()
  const { error } = await db
    .from('messages')
    .update({ deleted_at: new Date().toISOString(), ...REDACTED })
    .eq('id', messageId)

  if (error) return err('server', "Couldn't delete that. Try again.")
  return ok(null)
}

export async function togglePin(
  messageId: string,
  pinned: boolean,
): Promise<ActionResult<null>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const allowed = await assertCanModerateMessage(messageId, auth.data.role)
  if (!allowed.ok) return allowed

  const db = getServiceClient()
  // A deleted message must not be pinnable: the strip would show a blank line with no
  // way to unpin it from the stream, since deleted rows render as "message deleted".
  const { error } = await db
    .from('messages')
    .update({ is_pinned: pinned })
    .eq('id', messageId)
    .is('deleted_at', null)

  if (error) return err('server', "Couldn't pin that. Try again.")
  return ok(null)
}

export async function toggleLock(
  groupId: string,
  locked: boolean,
): Promise<ActionResult<null>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const db = getServiceClient()
  const { error } = await db.from('groups').update({ is_locked: locked }).eq('id', groupId)

  if (error) return err('server', "Couldn't change the room. Try again.")
  return ok(null)
}

export async function purgeRoom(groupId: string): Promise<ActionResult<{ count: number }>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const db = getServiceClient()
  let query = db
    .from('messages')
    .update({ deleted_at: new Date().toISOString(), ...REDACTED })
    .eq('group_id', groupId)
    .is('deleted_at', null)
    // Expired rows are already invisible to every reader and are waiting on the cron
    // job. Counting them would report a number the admin cannot see on screen.
    .gt('expires_at', new Date().toISOString())

  // The owner is the one moderation authority a co-admin cannot override. Filter the
  // owner's SUDO messages in the update itself so a room-wide clear follows the same
  // hierarchy as the one-message controls.
  if (auth.data.role === 'co_admin') {
    let owners: string[]
    try {
      owners = await ownerAdminIds()
    } catch {
      return err('server', "Couldn't clear the room. Try again.")
    }
    if (owners.length) {
      query = query.or(`admin_id.is.null,admin_id.not.in.(${owners.join(',')})`)
    }
  }

  const { data, error } = await query.select('id')

  if (error) return err('server', "Couldn't clear the room. Try again.")
  return ok({ count: data?.length ?? 0 })
}

export async function banAuthor(messageId: string): Promise<ActionResult<null>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const db = getServiceClient()

  // The hash is read server-side from the message. The client never holds one, so there
  // is nothing to spoof — banAuthor deliberately takes a message id instead of a hash.
  const { data: message } = await db
    .from('messages')
    .select('author_token_hash, admin_id')
    .eq('id', messageId)
    .maybeSingle()

  if (!message) return err('invalid', 'That message is already gone.')

  // Without this a co-admin can ban the owner's browser token for 24 hours by banning
  // any message the owner posted with a SUDO badge.
  if (message.admin_id) {
    return err('invalid', "You can't ban an admin.")
  }

  // Ban duration is deliberately 24 hours, not the 8-hour message lifetime. A ban that
  // expires along with the messages is barely a ban. See progress.md.
  const { error } = await db.from('bans').upsert({
    author_token_hash: message.author_token_hash,
    until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_by: auth.data.adminId,
  })

  if (error) return err('server', "Couldn't apply the ban. Try again.")
  return ok(null)
}
