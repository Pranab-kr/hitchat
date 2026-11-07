import { type ActionErrorCode, type ActionResult } from '@/lib/result'

// One place where an ActionResult becomes an HTTP answer. The JSON body is the result
// itself, so the CLI, the MCP package and a curl user all parse the same shape the
// browser already speaks.

const STATUS: Record<ActionErrorCode, number> = {
  invalid: 400,
  unauthorized: 401,
  banned: 403,
  locked: 403,
  not_found: 404,
  rate_limited: 429,
  server: 500,
}

export function jsonResult<T>(result: ActionResult<T>): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (!result.ok && result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter)
  }

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : STATUS[result.code],
    headers,
  })
}

export function errorJson(
  code: ActionErrorCode,
  message: string,
  retryAfter?: number,
): Response {
  return jsonResult(
    retryAfter === undefined ? { ok: false, code, message } : { ok: false, code, message, retryAfter },
  )
}

// A malformed body and a missing body are the same problem to the caller: the JSON did
// not parse into an object. Route handlers answer both with `invalid`, never a 500.
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await req.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
  } catch {
    return null
  }
}
