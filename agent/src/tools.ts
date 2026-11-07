import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { HitchatError, listRooms, readMessages, sendCode, sendMessage } from './client'
import type { Config } from './config'

// The four tools, identical in name and meaning to the hosted route's. Every handler is
// a thin call into the client, so a rule can only live on the server. The descriptions
// carry the limits a model needs before it tries: where paths come from, how long the
// text and code may be, that all of it expires, and that no admin action exists.

type ToolResult = {
  content: { type: 'text'; text: string }[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

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

// A refusal is a normal outcome, not a crash: the model gets the server's own wording
// (which already says when a ban lifts), plus the retry window when there is one.
function failure(error: unknown): ToolResult {
  const text =
    error instanceof HitchatError
      ? error.retryAfter === undefined
        ? error.message
        : `${error.message} Try again in ${error.retryAfter}s.`
      : error instanceof Error
        ? error.message
        : String(error)

  return { content: [{ type: 'text', text }], isError: true }
}

// `lang` is a plain string rather than an enum: the allowed list lives in the app and
// duplicating it here is the drift the design warns about. A wrong language comes back
// as the server's `invalid` message, which names what is allowed.
export function registerTools(server: McpServer, config: Config, fetchImpl?: typeof fetch): void {
  server.registerTool(
    'list_rooms',
    {
      title: 'List rooms',
      description:
        'Every room you can post in, as a path like cse/3/2/A with a locked flag.' + RULES,
    },
    async () => {
      try {
        return success({ rooms: await listRooms(config, fetchImpl) })
      } catch (error) {
        return failure(error)
      }
    },
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
        room: z.string().min(1).describe('Room path from list_rooms, e.g. cse/3/2/A'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('How many recent messages to return, 1-50. Default 20.'),
      }),
    },
    async ({ room, limit }) => {
      try {
        return success({ messages: await readMessages(config, room, limit, fetchImpl) })
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'send_message',
    {
      title: 'Send a message',
      description: 'Post text into a room as your anonymous handle.' + RULES,
      inputSchema: z.object({
        room: z.string().min(1).describe('Room path from list_rooms, e.g. cse/3/2/A'),
        text: z.string().describe('The message, up to 1,000 characters'),
        reply_to_id: z
          .string()
          .optional()
          .describe('Optional id of a live message in the same room'),
      }),
    },
    async ({ room, text, reply_to_id }) => {
      try {
        return success({ ...(await sendMessage(config, { room, text, reply_to_id }, fetchImpl)) })
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'send_code',
    {
      title: 'Send a code post',
      description: 'Post a code message into a room as your anonymous handle.' + RULES,
      inputSchema: z.object({
        room: z.string().min(1).describe('Room path from list_rooms, e.g. cse/3/2/A'),
        code: z.string().describe('The source, up to 50,000 characters. Indentation is kept.'),
        lang: z.string().describe('Highlighting language, e.g. python, javascript, c, sql'),
        title: z.string().max(80).optional().describe('Optional title, up to 80 characters'),
        lab_tag: z.string().max(24).optional().describe('Optional lab tag, up to 24 characters'),
        reply_to_id: z
          .string()
          .optional()
          .describe('Optional id of a live message in the same room'),
      }),
    },
    async ({ room, code, lang, title, lab_tag, reply_to_id }) => {
      try {
        return success({
          ...(await sendCode(
            config,
            { room, code, lang, title, lab_tag, reply_to_id },
            fetchImpl,
          )),
        })
      } catch (error) {
        return failure(error)
      }
    },
  )
}
