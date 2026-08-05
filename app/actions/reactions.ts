'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/identity'
import { assertNotBanned, assertRoomOpen, assertRateOk } from '@/lib/guards'
import { type ActionResult, ok, err } from '@/lib/result'

const EMOJIS = ['works', 'buggy', 'fire', 'eyes'] as const

export type ReactionState = { counts: Record<string, number>; mine: string[] }

// Ownership is echoed back rather than exposed: the client learns which reactions are
// its own without ever receiving a token hash.
async function readReactions(messageIds: string[], hash: string) {
  const db = getServiceClient()
  const { data } = await db
    .from('reactions')
    .select('message_id, emoji, author_token_hash')
    .in('message_id', messageIds)

  const result: Record<string, ReactionState> = {}

  for (const id of messageIds) {
    result[id] = { counts: {}, mine: [] }
  }

  for (const row of data ?? []) {
    const entry = result[row.message_id]
    if (!entry) continue
    entry.counts[row.emoji] = (entry.counts[row.emoji] ?? 0) + 1
    if (row.author_token_hash === hash) entry.mine.push(row.emoji)
  }

  return result
}

export async function toggleReaction(input: {
  token: string
  messageId: string
  emoji: string
}): Promise<ActionResult<ReactionState>> {
  if (!EMOJIS.includes(input.emoji as (typeof EMOJIS)[number])) {
    return err('invalid', 'That reaction is not available.')
  }

  const hash = hashToken(input.token)

  const banned = await assertNotBanned(hash)
  if (!banned.ok) return banned

  const db = getServiceClient()

  // A reaction is a write, so a locked room must refuse it — and reacting to a deleted
  // message would resurrect a count on a row whose content is already gone.
  const { data: message } = await db
    .from('messages')
    .select('group_id, deleted_at')
    .eq('id', input.messageId)
    .maybeSingle()

  if (!message || message.deleted_at) return err('invalid', 'That message is gone.')

  const open = await assertRoomOpen(message.group_id)
  if (!open.ok) return open

  const rate = await assertRateOk(hash, 'reaction')
  if (!rate.ok) return rate

  const { data: existing } = await db
    .from('reactions')
    .select('emoji')
    .eq('message_id', input.messageId)
    .eq('author_token_hash', hash)
    .eq('emoji', input.emoji)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('reactions')
      .delete()
      .eq('message_id', input.messageId)
      .eq('author_token_hash', hash)
      .eq('emoji', input.emoji)
    if (error) return err('server', "That didn't register. Try again.")
  } else {
    const { error } = await db.from('reactions').insert({
      message_id: input.messageId,
      author_token_hash: hash,
      emoji: input.emoji,
    })
    if (error) return err('server', "That didn't register. Try again.")
  }

  const all = await readReactions([input.messageId], hash)
  return ok(all[input.messageId])
}

export async function getReactions(input: {
  token: string
  messageIds: string[]
}): Promise<ActionResult<Record<string, ReactionState>>> {
  if (input.messageIds.length === 0) return ok({})
  // Unbounded input to a public action is a free query sink; the stream never holds
  // more than the 100 messages the room page loads.
  if (input.messageIds.length > 100) return err('invalid', 'Too many messages at once.')
  const hash = hashToken(input.token)
  return ok(await readReactions(input.messageIds, hash))
}
