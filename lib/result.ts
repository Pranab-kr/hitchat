export type ActionErrorCode =
  | 'rate_limited'
  | 'banned'
  | 'locked'
  | 'invalid'
  | 'unauthorized'
  | 'server'

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      code: ActionErrorCode
      message: string
      retryAfter?: number
    }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function err<T>(
  code: ActionErrorCode,
  message: string,
  retryAfter?: number,
): ActionResult<T> {
  return { ok: false, code, message, retryAfter }
}
