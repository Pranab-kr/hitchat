// No imports on purpose: the app's cross-surface test reads this list by relative path,
// and the published package keeps the same names in agent/src/names.ts. A test in
// tests/agent-mcp.test.ts asserts the two lists are equal, so a rename in one place
// cannot land without the other.
export const MCP_TOOL_NAMES = ['list_rooms', 'read_messages', 'send_message', 'send_code'] as const

export type McpToolName = (typeof MCP_TOOL_NAMES)[number]
