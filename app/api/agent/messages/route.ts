import { errorJson, jsonResult, readJsonObject } from '@/lib/agent/http'
import { postAgentText } from '@/lib/agent/post'
import { readMessages } from '@/lib/agent/read'
import { resolveRoom, roomPath, roomWebPath } from '@/lib/agent/rooms'
import { textBodySchema } from '@/lib/agent/schemas'
import { isToken, tokenFromHeader } from '@/lib/agent/token'
import { hashToken } from '@/lib/identity'
import { ok } from '@/lib/result'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_ROOM = 'No room at that path. Call /api/agent/rooms to see the list.'

// Returns the raw token, or the 401 response to hand straight back.
function requireToken(req: Request): string | Response {
  const token = tokenFromHeader(req)
  if (!isToken(token)) return errorJson('unauthorized', 'Send Authorization: Bearer <token>.')
  return token
}

export async function GET(req: Request) {
  const token = requireToken(req)
  if (typeof token !== 'string') return token

  const url = new URL(req.url)
  const path = url.searchParams.get('room')
  if (!path) return errorJson('invalid', 'Add ?room=<dept>/<year>/<batch>/<group>.')

  const rawLimit = url.searchParams.get('limit')
  let limit: number | undefined
  if (rawLimit !== null) {
    limit = Number(rawLimit)
    if (!Number.isInteger(limit)) return errorJson('invalid', 'limit must be a whole number.')
  }

  const room = await resolveRoom(path)
  if (!room) return errorJson('not_found', NO_ROOM)

  return jsonResult(ok({ room: roomPath(room), messages: await readMessages(room.id, limit) }))
}

export async function POST(req: Request) {
  const token = requireToken(req)
  if (typeof token !== 'string') return token

  const parsed = textBodySchema.safeParse(await readJsonObject(req))
  if (!parsed.success) {
    return errorJson('invalid', 'Body must be { "room": "...", "text": "..." }.')
  }

  const room = await resolveRoom(parsed.data.room)
  if (!room) return errorJson('not_found', NO_ROOM)

  const result = await postAgentText({
    hash: hashToken(token),
    groupId: room.id,
    text: parsed.data.text,
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
