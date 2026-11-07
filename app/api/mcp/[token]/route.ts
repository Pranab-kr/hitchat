import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { errorJson } from '@/lib/agent/http'
import { registerHostedTools } from '@/lib/agent/mcp'
import { isToken, resolveToken } from '@/lib/agent/token'
import { hashToken } from '@/lib/identity'

// The fourth front door: the same four tools as the published package, served over HTTP so
// ChatGPT or Claude web can add `https://<host>/api/mcp/<token>` as a connector with no
// OAuth. The token in the URL is the identity, exactly as it is in the browser — it is not
// a password, so nothing here is authorization, and a leaked URL can post as that handle
// and do nothing else.
//
// Phase 1 proved `createMcpHandler` works inside a Next route handler; the route shape,
// runtime and flags are unchanged since then.
//
// No Origin/Host check is added, and it would buy nothing: the endpoint authenticates with
// a URL token rather than a cookie, so there is no ambient credential for a cross-site
// request to borrow. The SDK's transport also requires an Accept header a browser form
// cannot set.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = createMcpHandler(
  ({ requestInfo }) => {
    // A header token wins over the path token, so a client that sends its own is never
    // overridden by a leaked URL. `check()` answers a malformed token with 401 before the
    // handler runs, so this throw is unreachable — kept loud rather than silent, because a
    // silent fallback here would register tools that post under an empty hash.
    const token = requestInfo ? resolveToken(requestInfo) : null
    if (!isToken(token)) throw new Error('mcp: server factory reached without a valid token')

    const hash = hashToken(token)
    const origin = requestInfo ? new URL(requestInfo.url).origin : undefined

    const server = new McpServer({ name: 'hitchat', version: '0.1.0' })
    registerHostedTools(server, hash, origin)
    return server
  },
  { responseMode: 'json' },
)

function unauthorized(): Response {
  return errorJson('unauthorized', 'Use /api/mcp/<token>, or send Authorization: Bearer <token>.')
}

// One guard for all three verbs: a client that sends a malformed token gets a clean 401
// instead of an empty tool list it would have to interpret.
function check(req: Request): Response | null {
  return isToken(resolveToken(req)) ? null : unauthorized()
}

export async function GET(req: Request) {
  return check(req) ?? handler.fetch(req)
}

export async function POST(req: Request) {
  return check(req) ?? handler.fetch(req)
}

export async function DELETE(req: Request) {
  return check(req) ?? handler.fetch(req)
}
