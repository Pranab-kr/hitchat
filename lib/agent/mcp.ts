import 'server-only'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { postAgentCode, postAgentText } from '@/lib/agent/post'
import { readMessages } from '@/lib/agent/read'
import { listRooms, resolveRoom, roomPath, roomWebPath, type ResolvedRoom } from '@/lib/agent/rooms'

// The hosted MCP tool set. These handlers call the service functions in lib/agent/
// directly instead of going back out over HTTP, so there is exactly one copy of every
// rule: ban → lock → validate → rate → insert lives in lib/agent/post.ts, and this file
// only has to resolve a path and shape a reply.
//
// The `hash` argument is the sha256 of the caller's token, computed by the route. The raw
// token never reaches this module, so it cannot end up in a log line or an error message.

type ToolResult = {
  content: { type: 'text'; text: string }[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

const NO_ROOM = 'No room at that path. Call list_rooms to see the list.'
const UNEXPECTED = "hitchat didn't answer. Try again."

// Same wording as the package's descriptions: a model that learned the rules from one
// surface must not be surprised by the other.
const RULES =
  ' Room paths come from list_rooms. Text is capped at 1,000 characters and code at 50,000. ' +
  'Everything disappears 8 hours after it is posted. There are no admin actions: you post as ' +
  'an anonymous handle and can never pin, lock, delete or ban.'

function success(data: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
  }
}

// A refusal keeps the server's own wording — those messages are written for a person and
// already say when a ban lifts — plus the wait, when there is one.
function failure(message: string, retryAfter?: number): ToolResult {
  const text = retryAfter === undefined ? message : `${message} Try again in ${retryAfter}s.`
  return { content: [{ type: 'text', text }], isError: true }
}

// An unexpected throw is still an answer to the caller. The internal message stays in the
// server log; the model gets a sentence it can act on.
async function attempt(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run()
  } catch (error) {
    console.error('mcp tool failed', error)
    return failure(UNEXPECTED)
  }
}

// The browser URL an agent can hand to a person. Without an origin (a unit test) the
// relative path is still correct, just less useful.
function webUrl(room: ResolvedRoom, origin?: string): string {
  const path = roomWebPath(room)
  return origin ? new URL(path, origin).toString() : path
}

const roomArg = z.string().min(1).describe('Room path from list_rooms, e.g. cse/3/2/A')
const replyArg = z
  .string()
  .optional()
  .describe('Optional id of a live message in the same room')

export function registerHostedTools(server: McpServer, hash: string, origin?: string): void {
  server.registerTool(
    'list_rooms',
    {
      title: 'List rooms',
      description:
        'Every room you can post in, as a path like cse/3/2/A with a locked flag.' + RULES,
    },
    () =>
      attempt(async () => {
        return success({ rooms: await listRooms() })
      }),
  )

  server.registerTool(
    'read_messages',
    {
      title: 'Read messages',
      description:
        'The most recent messages in a room, oldest first. Soft-deleted and expired ' +
        'messages are absent, and long code is cut at 8,000 characters with truncated: true.' +
        RULES,
      inputSchema: z.object({
        room: roomArg,
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('How many recent messages to return, 1-50. Default 20.'),
      }),
    },
    ({ room, limit }) =>
      attempt(async () => {
        const resolved = await resolveRoom(room)
        if (!resolved) return failure(NO_ROOM)

        return success({ messages: await readMessages(resolved.id, limit) })
      }),
  )

  server.registerTool(
    'send_message',
    {
      title: 'Send a message',
      description: 'Post text into a room as your anonymous handle.' + RULES,
      inputSchema: z.object({
        room: roomArg,
        text: z.string().describe('The message, up to 1,000 characters'),
        reply_to_id: replyArg,
      }),
    },
    ({ room, text, reply_to_id }) =>
      attempt(async () => {
        const resolved = await resolveRoom(room)
        if (!resolved) return failure(NO_ROOM)

        const result = await postAgentText({
          hash,
          groupId: resolved.id,
          text,
          replyToId: reply_to_id,
        })

        if (!result.ok) return failure(result.message, result.retryAfter)

        return success({
          ...result.data,
          room: roomPath(resolved),
          url: webUrl(resolved, origin),
        })
      }),
  )

  server.registerTool(
    'send_code',
    {
      title: 'Send a code post',
      description: 'Post a code message into a room as your anonymous handle.' + RULES,
      inputSchema: z.object({
        room: roomArg,
        code: z.string().describe('The source, up to 50,000 characters. Indentation is kept.'),
        lang: z.string().describe('Highlighting language, e.g. python, javascript, c, sql'),
        title: z.string().max(80).optional().describe('Optional title, up to 80 characters'),
        lab_tag: z.string().max(24).optional().describe('Optional lab tag, up to 24 characters'),
        reply_to_id: replyArg,
      }),
    },
    ({ room, code, lang, title, lab_tag, reply_to_id }) =>
      attempt(async () => {
        const resolved = await resolveRoom(room)
        if (!resolved) return failure(NO_ROOM)

        const result = await postAgentCode({
          hash,
          groupId: resolved.id,
          code,
          lang,
          title,
          labTag: lab_tag,
          replyToId: reply_to_id,
        })

        if (!result.ok) return failure(result.message, result.retryAfter)

        return success({
          ...result.data,
          room: roomPath(resolved),
          url: webUrl(resolved, origin),
        })
      }),
  )
}
