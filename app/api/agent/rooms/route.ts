import { errorJson, jsonResult } from '@/lib/agent/http'
import { listRooms } from '@/lib/agent/rooms'
import { isToken, tokenFromHeader } from '@/lib/agent/token'
import { ok } from '@/lib/result'

// Route handlers are uncached by default; the explicit flags keep a later config change
// from silently caching a room list that the owner edits by hand.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const token = tokenFromHeader(req)
  if (!isToken(token)) {
    return errorJson('unauthorized', 'Send Authorization: Bearer <token>.')
  }

  return jsonResult(ok({ rooms: await listRooms() }))
}
