// The agent surfaces share one identity rule: whatever token a caller presents becomes
// its anonymous handle, exactly as the browser's localStorage token does. Nothing is
// looked up or verified, so this module only has to reject values that could not be a
// token at all — a pasted newline, a URL fragment, an empty header.

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

export function isToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

// Header values arrive already trimmed by the HTTP layer; the trim here only handles the
// space after "Bearer". It never turns an invalid token into a valid one, because the
// trimmed value still has to match TOKEN_PATTERN.
export function tokenFromHeader(req: Request): string | null {
  const authorization = req.headers.get('authorization')

  if (authorization && /^bearer\s/i.test(authorization)) {
    const value = authorization.replace(/^bearer\s+/i, '').trim()
    return isToken(value) ? value : null
  }

  const header = req.headers.get('x-hitchat-token')
  return isToken(header) ? header : null
}

export function tokenFromPath(pathname: string): string | null {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  return isToken(segment) ? segment : null
}

// Used only by the hosted MCP route, where the token may ride in the path (the only
// thing ChatGPT and Claude web accept without OAuth) or in a Bearer header. A header
// always wins, so a client that sends its own token is never overridden by a leaked URL.
export function resolveToken(req: Request): string | null {
  return tokenFromHeader(req) ?? tokenFromPath(new URL(req.url).pathname)
}
