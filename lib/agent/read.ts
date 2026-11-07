import 'server-only'
import { getServiceClient } from '@/lib/supabase/admin'

// A snapshot for agents, not a stream. Realtime is a browser feature; an agent asks
// "what did I miss" and gets a bounded answer.

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const TRUNCATE_AT = 8000

export type AgentMessage = {
  id: string
  author: string
  kind: 'text' | 'code'
  body: string
  lang: string | null
  title: string | null
  lab_tag: string | null
  reply_to_id: string | null
  pinned: boolean
  created_at: string
  expires_at: string
  truncated?: true
}

type MessageRow = {
  id: string
  kind: 'text' | 'code'
  body: string
  code_lang: string | null
  code_title: string | null
  lab_tag: string | null
  reply_to_id: string | null
  author_name: string
  is_pinned: boolean
  created_at: string
  expires_at: string
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT

  const wanted = Math.trunc(limit)
  if (!Number.isFinite(wanted)) return DEFAULT_LIMIT

  // An explicit 0 is a caller mistake, not a request for everything: clamp into the
  // same 1..50 window as any other value instead of letting it fall back to the default.
  return Math.min(Math.max(1, wanted), MAX_LIMIT)
}

export async function readMessages(groupId: string, limit?: number): Promise<AgentMessage[]> {
  const db = getServiceClient()

  // Ordering is descending to take the *newest* n, then reversed for reading. An
  // ascending query with a limit returns the oldest rows in the room, which is the
  // trap this line exists to avoid.
  const { data } = await db
    .from('messages')
    .select(
      'id, kind, body, code_lang, code_title, lab_tag, reply_to_id, author_name, is_pinned, created_at, expires_at',
    )
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(clampLimit(limit))

  const rows = ((data ?? []) as unknown as MessageRow[]).reverse()

  return rows.map((row) => ({
    id: row.id,
    author: row.author_name,
    kind: row.kind,
    body: row.body.length > TRUNCATE_AT ? row.body.slice(0, TRUNCATE_AT) : row.body,
    lang: row.code_lang,
    title: row.code_title,
    lab_tag: row.lab_tag,
    reply_to_id: row.reply_to_id,
    pinned: row.is_pinned,
    created_at: row.created_at,
    expires_at: row.expires_at,
    ...(row.body.length > TRUNCATE_AT ? { truncated: true as const } : {}),
  }))
}
