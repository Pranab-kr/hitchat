// No imports on purpose: this file is the shared vocabulary between the published
// package and the hosted route, and the app's cross-surface test reads it directly
// (tests/agent-mcp.test.ts in phase 5) without pulling in the package's dependencies.
export const TOOL_NAMES = ['list_rooms', 'read_messages', 'send_message', 'send_code'] as const

export type ToolName = (typeof TOOL_NAMES)[number]
