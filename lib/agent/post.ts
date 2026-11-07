import 'server-only'
import { getServiceClient } from '@/lib/supabase/admin'
import { deriveHandle } from '@/lib/identity'
import { validateCode, validateText } from '@/lib/validate'
import { assertNotBanned, assertRateOk, assertRoomOpen } from '@/lib/guards'
import { type ActionResult, err, ok } from '@/lib/result'

// The one write path for agents. Deliberately NOT a wrapper around sendText/postCode:
// those read the admin cookie to grant a SUDO badge and a locked-room exemption. An
// agent is never an admin, so this module never imports currentAdminId, never touches
// cookies, and always writes admin_id: null.
//
// Guard order matches the web path: ban → lock → validate → rate limit → insert. The
// rate check records an event, so a post rejected for length must not consume quota.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function assertReplyInRoom(
  replyToId: string | undefined,
  groupId: string,
): Promise<ActionResult<null>> {
  if (!replyToId) return ok(null)
  if (!UUID.test(replyToId)) return err('invalid', 'That reply target is not a message id.')

  const db = getServiceClient()
  const { data } = await db
    .from('messages')
    .select('id')
    .eq('id', replyToId)
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  return data ? ok(null) : err('invalid', 'The message you replied to is gone.')
}

type AgentPost = {
  hash: string
  groupId: string
  kind: 'text' | 'code'
  body: string
  lang?: string
  title?: string
  labTag?: string
  replyToId?: string
}

async function postAgentMessage(input: AgentPost): Promise<ActionResult<{ id: string }>> {
  const banned = await assertNotBanned(input.hash)
  if (!banned.ok) return banned

  const open = await assertRoomOpen(input.groupId)
  if (!open.ok) return open

  const invalid =
    input.kind === 'text'
      ? validateText(input.body)
      : validateCode({
          body: input.body,
          lang: input.lang ?? '',
          title: input.title,
          labTag: input.labTag,
        })
  if (invalid) return err('invalid', invalid)

  const reply = await assertReplyInRoom(input.replyToId, input.groupId)
  if (!reply.ok) return reply

  const rate = await assertRateOk(input.hash, input.kind)
  if (!rate.ok) return rate

  const { name, color } = deriveHandle(input.hash)
  const db = getServiceClient()

  const { data, error } = await db
    .from('messages')
    .insert({
      group_id: input.groupId,
      kind: input.kind,
      // Text is trimmed; code keeps its indentation, which is the whole point of it.
      body: input.kind === 'text' ? input.body.trim() : input.body,
      code_lang: input.kind === 'code' ? input.lang : null,
      code_title: input.kind === 'code' ? input.title?.trim() || null : null,
      lab_tag: input.kind === 'code' ? input.labTag?.trim() || null : null,
      reply_to_id: input.replyToId ?? null,
      author_token_hash: input.hash,
      author_name: name,
      author_color: color,
      admin_id: null,
    })
    .select('id')
    .single()

  if (error || !data) return err('server', "Message didn't send. Try again.")
  return ok({ id: data.id })
}

export async function postAgentText(input: {
  hash: string
  groupId: string
  text: string
  replyToId?: string
}): Promise<ActionResult<{ id: string }>> {
  return postAgentMessage({
    hash: input.hash,
    groupId: input.groupId,
    kind: 'text',
    body: input.text,
    replyToId: input.replyToId,
  })
}

export async function postAgentCode(input: {
  hash: string
  groupId: string
  code: string
  lang: string
  title?: string
  labTag?: string
  replyToId?: string
}): Promise<ActionResult<{ id: string }>> {
  return postAgentMessage({
    hash: input.hash,
    groupId: input.groupId,
    kind: 'code',
    body: input.code,
    lang: input.lang,
    title: input.title,
    labTag: input.labTag,
    replyToId: input.replyToId,
  })
}
