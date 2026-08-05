'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { hashToken, deriveHandle } from '@/lib/identity'
import { validateText, validateCode } from '@/lib/validate'
import { assertNotBanned, assertRoomOpen, assertRateOk } from '@/lib/guards'
import { currentAdminId } from '@/lib/auth/current-admin'
import { type ActionResult, ok, err } from '@/lib/result'

// Spec: "Lock room (read-only for students; admins can still post)". The admin id is
// derived from the session cookie server-side and never accepted as an argument — an
// isAdmin parameter would let any client mint itself a SUDO badge.
//
// The exemption covers the LOCK check only. An admin is still rate limited, still
// validated, and still subject to a ban on their own token. Guard order stays
// ban → lock → validate → rate limit: the rate check records an event, so a message
// rejected for length must not consume the poster's quota.
async function assertPostableAs(
  hash: string,
  groupId: string,
  adminId: string | null,
): Promise<ActionResult<null>> {
  const banned = await assertNotBanned(hash)
  if (!banned.ok) return banned

  const open = await assertRoomOpen(groupId)
  if (!open.ok) {
    // A room that no longer exists is refused for everyone; only the lock is waived.
    if (open.code !== 'locked' || !adminId) return open
  }

  return ok(null)
}

export async function sendText(input: {
  token: string
  groupId: string
  body: string
  replyToId?: string
}): Promise<ActionResult<{ id: string }>> {
  const hash = hashToken(input.token)
  const adminId = await currentAdminId()

  const postable = await assertPostableAs(hash, input.groupId, adminId)
  if (!postable.ok) return postable

  const invalid = validateText(input.body)
  if (invalid) return err('invalid', invalid)

  const rate = await assertRateOk(hash, 'text')
  if (!rate.ok) return rate

  const { name, color } = deriveHandle(hash)
  const db = getServiceClient()

  const { data, error } = await db
    .from('messages')
    .insert({
      group_id: input.groupId,
      kind: 'text',
      body: input.body.trim(),
      reply_to_id: input.replyToId ?? null,
      author_token_hash: hash,
      author_name: name,
      author_color: color,
      admin_id: adminId,
    })
    .select('id')
    .single()

  if (error || !data) return err('server', "Message didn't send. Try again.")
  return ok({ id: data.id })
}

export async function postCode(input: {
  token: string
  groupId: string
  body: string
  lang: string
  title?: string
  labTag?: string
  replyToId?: string
}): Promise<ActionResult<{ id: string }>> {
  const hash = hashToken(input.token)
  const adminId = await currentAdminId()

  const postable = await assertPostableAs(hash, input.groupId, adminId)
  if (!postable.ok) return postable

  const invalid = validateCode(input)
  if (invalid) return err('invalid', invalid)

  const rate = await assertRateOk(hash, 'code')
  if (!rate.ok) return rate

  const { name, color } = deriveHandle(hash)
  const db = getServiceClient()

  const { data, error } = await db
    .from('messages')
    .insert({
      group_id: input.groupId,
      kind: 'code',
      body: input.body,
      code_lang: input.lang,
      code_title: input.title?.trim() || null,
      lab_tag: input.labTag?.trim() || null,
      reply_to_id: input.replyToId ?? null,
      author_token_hash: hash,
      author_name: name,
      author_color: color,
      admin_id: adminId,
    })
    .select('id')
    .single()

  if (error || !data) return err('server', "Code didn't post. Try again.")
  return ok({ id: data.id })
}

export async function deleteOwnMessage(input: {
  token: string
  messageId: string
}): Promise<ActionResult<null>> {
  const hash = hashToken(input.token)
  const db = getServiceClient()

  const { data: message } = await db
    .from('messages')
    .select('author_token_hash, created_at, deleted_at')
    .eq('id', input.messageId)
    .maybeSingle()

  if (!message) return err('invalid', 'That message is already gone.')
  if (message.deleted_at) return ok(null)

  // Ownership is derived server-side, never trusted from the client.
  if (message.author_token_hash !== hash) {
    return err('unauthorized', 'You can only delete your own messages.')
  }

  const ageMs = Date.now() - new Date(message.created_at).getTime()
  if (ageMs > 5 * 60 * 1000) {
    return err('invalid', 'You can only delete a message within 5 minutes of posting.')
  }

  // Soft delete: Realtime can filter an UPDATE but not a DELETE. Content is blanked
  // so it leaves the database immediately rather than being merely hidden.
  const { error } = await db
    .from('messages')
    .update({
      deleted_at: new Date().toISOString(),
      body: '',
      code_lang: null,
      code_title: null,
      lab_tag: null,
    })
    .eq('id', input.messageId)

  if (error) return err('server', "Couldn't delete that. Try again.")
  return ok(null)
}
