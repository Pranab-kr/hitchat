// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import { hashToken } from '../lib/identity'
import { postAgentCode, postAgentText } from '../lib/agent/post'
import { readMessages } from '../lib/agent/read'
import { listRooms, resolveRoom } from '../lib/agent/rooms'
import { MCP_TOOL_NAMES } from '../lib/agent/mcp-names'
import { registerHostedTools } from '../lib/agent/mcp'
import { TOOL_NAMES } from '../agent/src/names'

// The hosted route must advertise the same four tools as the published package, and its
// handlers must reach the same service functions the HTTP API uses. Everything below the
// tool layer is mocked: what is under test is the wiring, and the service functions have
// their own live-database tests.

vi.mock('@/lib/agent/post', () => ({
  postAgentText: vi.fn(),
  postAgentCode: vi.fn(),
}))

vi.mock('@/lib/agent/read', () => ({
  readMessages: vi.fn(),
}))

// Only the two queries are stubbed; roomWebPath is the real one, because the reply's
// `url` is part of the contract an agent reads.
vi.mock('@/lib/agent/rooms', async () => {
  const actual = await vi.importActual<typeof import('../lib/agent/rooms')>('@/lib/agent/rooms')
  return { ...actual, listRooms: vi.fn(), resolveRoom: vi.fn() }
})

const TOKEN = 'd'.repeat(36)
const HASH = hashToken(TOKEN)

const room = {
  id: 'g-1',
  label: 'A',
  isLocked: false,
  deptName: 'Test Dept',
  dept: 'cse',
  year: 3,
  batch: 2,
  group: 'A',
}

type ToolResult = {
  content: { type: string; text: string }[]
  isError?: boolean
}

type Registered = {
  name: string
  config: { description?: string; inputSchema?: unknown }
  handler: (args: never) => Promise<ToolResult>
}

function fakeServer() {
  const tools: Registered[] = []
  const server = {
    registerTool: (name: string, config: Registered['config'], handler: Registered['handler']) => {
      tools.push({ name, config, handler })
      return {}
    },
  }

  return { tools, server: server as unknown as McpServer }
}

const byName = (tools: Registered[], name: string) => tools.find((tool) => tool.name === name)!

const parsed = (result: ToolResult) => JSON.parse(result.content[0].text) as unknown

// Accepts either framing: our own 401 is plain JSON, the MCP handler answers over SSE.
async function rpcBody(res: Response): Promise<unknown> {
  const text = await res.text()
  const data = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .at(-1)

  return JSON.parse(data ? data.slice('data:'.length).trim() : text)
}

beforeEach(() => {
  // Without this, a call recorded by an earlier case makes a later `not.toHaveBeenCalled`
  // assertion meaningless.
  vi.clearAllMocks()

  vi.mocked(postAgentText).mockResolvedValue({ ok: true, data: { id: 'm-1', expires_at: '2026-11-07T22:00:00Z' } })
  vi.mocked(postAgentCode).mockResolvedValue({ ok: true, data: { id: 'm-2', expires_at: '2026-11-07T22:00:00Z' } })
  vi.mocked(readMessages).mockResolvedValue([])
  vi.mocked(listRooms).mockResolvedValue([
    { path: 'cse/3/2/A', dept: 'cse', year: 3, batch: 2, group: 'A', locked: false },
  ])
  vi.mocked(resolveRoom).mockResolvedValue(room)
})

describe('the two tool lists', () => {
  it('are identical, so the hosted route and the package cannot drift', () => {
    expect([...MCP_TOOL_NAMES]).toEqual([...TOOL_NAMES])
  })

  it('register exactly four tools, in order', () => {
    const { tools, server } = fakeServer()

    registerHostedTools(server, HASH, 'http://localhost:3000')

    expect(tools.map((tool) => tool.name)).toEqual([...MCP_TOOL_NAMES])
  })

  it('give every tool a description that states the rules', () => {
    const { tools, server } = fakeServer()

    registerHostedTools(server, HASH, 'http://localhost:3000')

    for (const tool of tools) {
      expect(tool.config.description).toContain('8 hours')
      expect(tool.config.description).toContain('no admin')
    }
  })
})

describe('registerHostedTools', () => {
  it('sends with the hash it was given, never the raw token', async () => {
    const { tools, server } = fakeServer()
    registerHostedTools(server, HASH, 'http://localhost:3000')

    await byName(tools, 'send_message').handler({ room: 'cse/3/2/A', text: 'hello' } as never)

    expect(postAgentText).toHaveBeenCalledTimes(1)
    expect(postAgentText).toHaveBeenCalledWith({
      hash: HASH,
      groupId: 'g-1',
      text: 'hello',
      replyToId: undefined,
    })
    expect(vi.mocked(postAgentText).mock.calls[0][0].hash).not.toBe(TOKEN)
  })

  it('posts code through postAgentCode with lang, title and lab tag', async () => {
    const { tools, server } = fakeServer()
    registerHostedTools(server, HASH, 'http://localhost:3000')

    const result = await byName(tools, 'send_code').handler({
      room: 'cse/3/2/A',
      code: 'print(1)',
      lang: 'python',
      title: 'Demo',
      lab_tag: 'Lab 3',
    } as never)

    expect(postAgentCode).toHaveBeenCalledWith({
      hash: HASH,
      groupId: 'g-1',
      code: 'print(1)',
      lang: 'python',
      title: 'Demo',
      labTag: 'Lab 3',
      replyToId: undefined,
    })
    // The reply carries an absolute browser URL, the same shape the HTTP API returns.
    expect(parsed(result)).toEqual({
      id: 'm-2',
      expires_at: '2026-11-07T22:00:00Z',
      room: 'cse/3/2/A',
      url: 'http://localhost:3000/c/cse/3/2/a',
    })
  })

  it('reads a snapshot after resolving the room path', async () => {
    const { tools, server } = fakeServer()
    registerHostedTools(server, HASH, 'http://localhost:3000')

    const result = await byName(tools, 'read_messages').handler({
      room: 'cse/3/2/A',
      limit: 5,
    } as never)

    expect(resolveRoom).toHaveBeenCalledWith('cse/3/2/A')
    expect(readMessages).toHaveBeenCalledWith('g-1', 5)
    expect(parsed(result)).toEqual({ messages: [] })
  })

  it('lists rooms without touching a room path', async () => {
    const { tools, server } = fakeServer()
    registerHostedTools(server, HASH, 'http://localhost:3000')

    const result = await byName(tools, 'list_rooms').handler({} as never)

    expect(parsed(result)).toEqual({
      rooms: [{ path: 'cse/3/2/A', dept: 'cse', year: 3, batch: 2, group: 'A', locked: false }],
    })
  })

  it('answers an unknown room with isError instead of throwing', async () => {
    vi.mocked(resolveRoom).mockResolvedValue(null)
    const { tools, server } = fakeServer()
    registerHostedTools(server, HASH, 'http://localhost:3000')

    const result = await byName(tools, 'send_message').handler({
      room: 'nope/1/1/A',
      text: 'hello',
    } as never)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('list_rooms')
    expect(postAgentText).not.toHaveBeenCalled()
  })

  it('turns a refusal into isError with the server message and retry window', async () => {
    vi.mocked(postAgentText).mockResolvedValue({
      ok: false,
      code: 'rate_limited',
      message: 'You are posting too fast.',
      retryAfter: 7,
    })
    const { tools, server } = fakeServer()
    registerHostedTools(server, HASH, 'http://localhost:3000')

    const result = await byName(tools, 'send_message').handler({
      room: 'cse/3/2/A',
      text: 'hello',
    } as never)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('You are posting too fast.')
    expect(result.content[0].text).toContain('7s')
  })
})

describe('the hosted route', () => {
  const rpc = (token: string) =>
    new Request(`http://localhost:3000/api/mcp/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    })

  it('answers a malformed token with 401 before any tool exists', async () => {
    const { POST } = await import('../app/api/mcp/[token]/route')

    const res = await POST(rpc('too-short'))

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ ok: false, code: 'unauthorized' })
  })

  it('serves the four tools to a valid token, read from the path', async () => {
    const { POST } = await import('../app/api/mcp/[token]/route')

    const res = await POST(rpc('e'.repeat(36)))

    // The handler answers a request that accepts text/event-stream over SSE even in
    // `responseMode: 'json'`, so the reply is a `data:` line, not a bare body. That is
    // also what scripts/mcp-probe.ts decodes against a real build.
    const body = (await rpcBody(res)) as { result?: { tools?: { name: string }[] } }

    expect(res.status).toBe(200)
    expect(body.result?.tools?.map((tool) => tool.name)).toEqual([...MCP_TOOL_NAMES])
  })
})
