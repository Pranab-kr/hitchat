#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { resolveConfig } from './config'
import { registerTools } from './tools'

// `hitchat-mcp`: the local stdio server. It speaks the same HTTP API as the CLI, holds
// no secret, and holds no rules of its own.
//
// stdout belongs to the protocol, so every diagnostic goes to stderr. A server with no
// config would advertise four tools that all fail, which is worse than refusing to start.
const config = resolveConfig()

if (!config) {
  process.stderr.write(
    'hitchat-mcp: no config. Run `hitchat init --url <url> --new`, or set HITCHAT_URL and HITCHAT_TOKEN.\n',
  )
  process.exit(1)
}

serveStdio(() => {
  const server = new McpServer(
    { name: 'hitchat', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  registerTools(server, config)
  return server
})
