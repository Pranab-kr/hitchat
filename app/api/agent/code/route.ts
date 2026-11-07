import { errorJson, jsonResult, readJsonObject } from '@/lib/agent/http'
import { postAgentCode } from '@/lib/agent/post'
import { resolveRoom, roomPath, roomWebPath } from '@/lib/agent/rooms'
import { codeBodySchema } from '@/lib/agent/schemas'
import { isToken, tokenFromHeader } from '@/lib/agent/token'
import { hashToken } from '@/lib/identity'
import { ok } from '@/lib/result'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const token = tokenFromHeader(req)
  if (!isToken(token)) {
    return errorJson('unauthorized', 'Send Authorization: Bearer <token>.')
  }

  const parsed = codeBodySchema.safeParse(await readJsonObject(req))
  if (!parsed.success) {
    return errorJson(
      'invalid',
      'Body must be { "room": "...", "code": "...", "lang": "<allowed language>" }.',
    )
  }

  const room = await resolveRoom(parsed.data.room)
  if (!room) {
    return errorJson('not_found', 'No room at that path. Call /api/agent/rooms to see the list.')
  }

  const result = await postAgentCode({
    hash: hashToken(token),
    groupId: room.id,
    code: parsed.data.code,
    lang: parsed.data.lang,
    title: parsed.data.title,
    labTag: parsed.data.lab_tag,
    replyToId: parsed.data.reply_to_id,
  })

  if (!result.ok) return jsonResult(result)

  return jsonResult(
    ok({
      ...result.data,
      room: roomPath(room),
      url: new URL(roomWebPath(room), req.url).toString(),
    }),
  )
}
