import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'

// Phase-1 gate for agent access: prove the MCP SDK can serve through a Next route
// handler before any product code is built on it. The `ping` tool is replaced by the
// real tool set in phase 5; the route shape, runtime and flags stay.
//
// The handler is validation-free by design (see its docs), and this endpoint carries no
// secrets, so Origin/Host checks are not added yet. Revisit in phase 5 if the token in
// the URL ever becomes more than an anonymous handle.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = createMcpHandler(
  () => {
    const server = new McpServer({ name: 'hitchat', version: '0.0.0' })

    server.registerTool(
      'ping',
      {
        title: 'Ping',
        description: 'Returns pong. Used to prove the MCP transport works.',
      },
      async () => ({
        content: [{ type: 'text', text: 'pong' }],
      }),
    )

    return server
  },
  { responseMode: 'json' },
)

export async function GET(req: Request) {
  return handler.fetch(req)
}

export async function POST(req: Request) {
  return handler.fetch(req)
}

export async function DELETE(req: Request) {
  return handler.fetch(req)
}
