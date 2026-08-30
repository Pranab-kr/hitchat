'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/identity'
import { currentBanMessage } from '@/lib/guards'
import { type ActionResult, ok, err } from '@/lib/result'

// The anonymous identity is a peppered hash the client can never compute (the pepper
// is a server secret), so "which of these messages are mine?" and "can I post yet?"
// must be answered here, echoed back as booleans rather than exposing the hash.
export async function getOwnMessageIds(input: {
  token: string
  messageIds: string[]
}): Promise<ActionResult<{ ids: string[] }>> {
  if (input.messageIds.length === 0) return ok({ ids: [] })
  // Unbounded input to a public action is a free query sink; the stream never holds
  // more than the 100 messages the room page loads.
  if (input.messageIds.length > 100) return err('invalid', 'Too many messages at once.')

  const hash = hashToken(input.token)
  const db = getServiceClient()

  const { data, error } = await db
    .from('messages')
    .select('id')
    .in('id', input.messageIds)
    .eq('author_token_hash', hash)

  if (error) return err('server', 'Something went wrong. Try again.')
  return ok({ ids: (data ?? []).map((row) => row.id) })
}

// Powers the "surface banned state before Send" gate in the composers. The rate-limit
// half is handled reactively (retryAfter countdown), because probing it would consume
// quota; a ban is a pure read and is safe to poll.
export async function getPostingStatus(input: {
  token: string
}): Promise<ActionResult<{ bannedMessage: string | null }>> {
  const hash = hashToken(input.token)
  return ok({ bannedMessage: await currentBanMessage(hash) })
}
