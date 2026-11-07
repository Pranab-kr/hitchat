#!/usr/bin/env bun
// Minimal MCP-over-HTTP probe. No client SDK: it speaks JSON-RPC directly so a
// transport failure is visible as a status code and a body, not a library stack.
//
//   bun run scripts/mcp-probe.ts http://localhost:3000/api/mcp/<token>
//
// Prints `TOOLS: <names>` and exits 0 when initialize + tools/list succeed.

const url = process.argv[2]

if (!url) {
  console.error('usage: bun run scripts/mcp-probe.ts <url>')
  process.exit(2)
}

type RpcReply = { result?: unknown; error?: { code: number; message: string } }
type ToolList = { tools?: Array<{ name: string }> }

let nextId = 0

function parseReply(res: Response, text: string): RpcReply {
  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('text/event-stream')) {
    const line = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('data:'))
      .at(-1)
    if (!line) throw new Error('empty SSE body')
    return JSON.parse(line.slice('data:'.length).trim()) as RpcReply
  }

  return JSON.parse(text) as RpcReply
}

async function rpc(method: string, params?: unknown, notify = false): Promise<unknown> {
  const body: Record<string, unknown> = { jsonrpc: '2.0', method }
  if (params !== undefined) body.params = params
  if (!notify) body.id = ++nextId

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The SDK's transport rejects a request that does not accept both.
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`${method} -> HTTP ${res.status}: ${text.slice(0, 400)}`)
  }

  if (notify) return null

  const reply = parseReply(res, text)
  if (reply.error) {
    throw new Error(`${method} -> ${reply.error.code}: ${reply.error.message}`)
  }
  return reply.result
}

try {
  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'hitchat-probe', version: '0' },
  })
  await rpc('notifications/initialized', {}, true)

  const list = (await rpc('tools/list')) as ToolList
  const names = (list.tools ?? []).map((tool) => tool.name)

  console.log(`TOOLS: ${names.join(' ') || '(none)'}`)
  process.exit(names.length > 0 ? 0 : 1)
} catch (error) {
  console.error(`PROBE FAILED: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

// Top-level await needs this file to be a module under the app's tsconfig, which
// `next build` type-checks.
export {}
