import type { Config } from './config'
import type { AgentMessage, RoomSummary, SendCodeInput, SendTextInput, SentMessage } from './types'

// One HTTP client for the CLI and the local MCP server. It holds no rules of its own:
// length limits, bans, locks and rate limiting all live in the Next app, and
// re-implementing them here is an anti-goal in the design. The client's only jobs are to
// carry the token, turn `{ ok: false }` into a typed throw, and unwrap `data`.

export class HitchatError extends Error {
  readonly code: string
  readonly retryAfter?: number

  constructor(code: string, message: string, retryAfter?: number) {
    super(message)
    this.name = 'HitchatError'
    this.code = code
    this.retryAfter = retryAfter
  }
}

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; retryAfter?: number }

function retryAfterFromHeader(res: Response): number | undefined {
  const raw = res.headers.get('retry-after')
  if (!raw) return undefined
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

export async function apiCall<T>(
  config: Config,
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const base = config.url.replace(/\/+$/, '')
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`

  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${config.token}`)
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  let res: Response
  try {
    res = await fetchImpl(url, { ...init, headers })
  } catch {
    // A wrong URL is the most common first-run mistake, so the message names the host
    // the user configured rather than the fetch failure.
    throw new HitchatError('network', `Could not reach ${base}. Check the URL and that the app is running.`)
  }

  let body: Envelope<T> | null = null
  try {
    body = (await res.json()) as Envelope<T>
  } catch {
    body = null
  }

  if (body && body.ok === true) return body.data

  if (body && typeof body.code === 'string' && typeof body.message === 'string') {
    throw new HitchatError(body.code, body.message, body.retryAfter ?? retryAfterFromHeader(res))
  }

  // A proxy error page, an HTML 404, or a different service on that port. Naming the
  // status is the only thing that helps here.
  throw new HitchatError('server', `${base} answered ${res.status} with something that is not hitchat.`)
}

export async function listRooms(
  config: Config,
  fetchImpl?: typeof fetch,
): Promise<RoomSummary[]> {
  const data = await apiCall<{ rooms: RoomSummary[] }>(config, '/api/agent/rooms', {}, fetchImpl)
  return data.rooms
}

export async function readMessages(
  config: Config,
  room: string,
  limit?: number,
  fetchImpl?: typeof fetch,
): Promise<AgentMessage[]> {
  const query = limit === undefined ? '' : `&limit=${limit}`
  const data = await apiCall<{ room: string; messages: AgentMessage[] }>(
    config,
    `/api/agent/messages?room=${encodeURIComponent(room)}${query}`,
    {},
    fetchImpl,
  )
  return data.messages
}

export async function sendMessage(
  config: Config,
  input: SendTextInput,
  fetchImpl?: typeof fetch,
): Promise<SentMessage> {
  return apiCall<SentMessage>(
    config,
    '/api/agent/messages',
    { method: 'POST', body: JSON.stringify(input) },
    fetchImpl,
  )
}

export async function sendCode(
  config: Config,
  input: SendCodeInput,
  fetchImpl?: typeof fetch,
): Promise<SentMessage> {
  return apiCall<SentMessage>(
    config,
    '/api/agent/code',
    { method: 'POST', body: JSON.stringify(input) },
    fetchImpl,
  )
}
