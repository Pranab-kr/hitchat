import { describe, expect, it } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import { TOOL_NAMES } from '../src/names'
import { registerTools } from '../src/tools'
import type { Config } from '../src/config'

// A fake server that records registrations. The real McpServer is exercised in the
// driven run; what these cases pin is that both front doors advertise the same four
// tools and that every handler answers with MCP content, never a bare string.

const config: Config = { url: 'http://localhost:3000', token: 'c'.repeat(36) }

const sent = {
  id: 'm-1',
  room: 'cse/3/2/A',
  url: 'http://localhost:3000/c/cse/3/2/a',
  expires_at: '2026-11-07T22:00:00.000Z',
}

type Registered = {
  name: string
  config: { title?: string; description?: string; inputSchema?: unknown }
  handler: (args: never) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>
}

function fakeServer() {
  const tools: Registered[] = []

  const server = {
    registerTool: (
      name: string,
      toolConfig: Registered['config'],
      handler: Registered['handler'],
    ) => {
      tools.push({ name, config: toolConfig, handler })
      return {}
    },
  }

  return { tools, server: server as unknown as McpServer }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

// One stub covering all four endpoints, so a handler test does not care which tool it is.
// It records the requests so a handler can be checked against the wire, not just its reply.
function stubFetch(fail?: { code: string; message: string }) {
  const calls: { path: string; method: string; search: string }[] = []

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    calls.push({
      path: url.pathname,
      method: init?.method ?? 'GET',
      search: url.search,
    })

    if (fail) return json({ ok: false, ...fail }, 429)

    if (url.pathname === '/api/agent/rooms') {
      return json({
        ok: true,
        data: { rooms: [{ path: 'cse/3/2/A', dept: 'cse', year: 3, batch: 2, group: 'A', locked: false }] },
      })
    }

    if (url.pathname === '/api/agent/messages' && !init?.method) {
      return json({ ok: true, data: { room: 'cse/3/2/A', messages: [] } })
    }

    return json({ ok: true, data: sent })
  }

  return { fetchImpl, calls }
}

const argsFor = (name: string): never => {
  switch (name) {
    case 'list_rooms':
      return {} as never
    case 'read_messages':
      return { room: 'cse/3/2/A' } as never
    case 'send_message':
      return { room: 'cse/3/2/A', text: 'hello' } as never
    default:
      return { room: 'cse/3/2/A', code: 'print(1)', lang: 'python' } as never
  }
}

describe('registerTools', () => {
  it('registers exactly the four tool names, in order', () => {
    const { tools, server } = fakeServer()
    const { fetchImpl } = stubFetch()

    registerTools(server, config, fetchImpl)

    expect(tools.map((tool) => tool.name)).toEqual([...TOOL_NAMES])
  })

  it('gives every tool a description that states the rules', () => {
    const { tools, server } = fakeServer()
    const { fetchImpl } = stubFetch()

    registerTools(server, config, fetchImpl)

    for (const tool of tools) {
      expect(tool.config.description).toBeTruthy()
      expect(tool.config.description).toContain('8 hours')
      expect(tool.config.description).toContain('no admin')
    }
  })

  it('returns text content, never a bare string, from every handler', async () => {
    const { tools, server } = fakeServer()
    const { fetchImpl } = stubFetch()
    registerTools(server, config, fetchImpl)

    for (const tool of tools) {
      const result = await tool.handler(argsFor(tool.name))

      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0].type).toBe('text')
      expect(typeof result.content[0].text).toBe('string')
      expect(result.isError).toBeUndefined()
    }
  })

  it('passes the room path and limit from read_messages to the API', async () => {
    const { tools, server } = fakeServer()
    const { fetchImpl, calls } = stubFetch()
    registerTools(server, config, fetchImpl)
    const read = tools.find((tool) => tool.name === 'read_messages')!

    const result = await read.handler({ room: 'cse/3/2/A', limit: 5 } as never)

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].path).toBe('/api/agent/messages')
    expect(calls[0].search).toContain('room=cse%2F3%2F2%2FA')
    expect(calls[0].search).toContain('limit=5')
    expect(JSON.parse(result.content[0].text)).toEqual({ messages: [] })
  })

  it('turns a server refusal into isError with the server message', async () => {
    const { tools, server } = fakeServer()
    const { fetchImpl } = stubFetch({ code: 'rate_limited', message: 'You are posting too fast.' })
    registerTools(server, config, fetchImpl)
    const send = tools.find((tool) => tool.name === 'send_message')!

    const result = await send.handler({ room: 'cse/3/2/A', text: 'hi' } as never)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('You are posting too fast.')
  })
})
