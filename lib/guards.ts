import 'server-only'
import { getServiceClient } from '@/lib/supabase/admin'
import { currentAdmin } from '@/lib/auth/current-admin'
import { hashToken } from '@/lib/identity'
import { type ActionResult, ok, err } from '@/lib/result'

// The composer gate polls ban state before Send; it reads through the same query as
// the write path so the two can never disagree about who is banned or for how long.
export async function currentBanMessage(hash: string): Promise<string | null> {
  const db = getServiceClient()
  const { data } = await db
    .from('bans')
    .select('until')
    .eq('author_token_hash', hash)
    .gt('until', new Date().toISOString())
    .maybeSingle()

  if (!data) return null
  const until = new Date(data.until).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `You can't post here until ${until}.`
}

export async function assertNotBanned(hash: string): Promise<ActionResult<null>> {
  const message = await currentBanMessage(hash)
  return message ? err('banned', message) : ok(null)
}

export async function assertRoomOpen(groupId: string): Promise<ActionResult<null>> {
  const db = getServiceClient()
  const { data } = await db
    .from('groups')
    .select('is_locked')
    .eq('id', groupId)
    .maybeSingle()

  if (!data) return err('invalid', 'That room no longer exists.')
  if (data.is_locked) return err('locked', 'This room is read-only right now.')
  return ok(null)
}

export async function assertRateOk(
  hash: string,
  action: 'text' | 'code' | 'reaction' | 'admin_login' | 'room',
): Promise<ActionResult<null>> {
  const db = getServiceClient()
  const { data, error } = await db.rpc('check_rate_limit', {
    p_hash: hash,
    p_action: action,
  })

  if (error) return err('server', 'Something went wrong. Try again.')
  if (data === false) {
    // retryAfter was once a hardcoded 10 the UI threw away. Now it is the real
    // seconds until this hash+action window clears, so the composer can count it down
    // instead of telling a user to "wait a moment" blind.
    const { retryAfter, recent } = await rateWindow(hash, action)

    // check_rate_limit answers `false` for an action it does not know, which is exactly
    // how a migration that has not been applied presents itself — the caller then has to
    // read "you have done this too much" about something they never did. With nothing in
    // the window there is nothing to wait for, so name the real problem instead.
    if (recent === 0) {
      return err(
        'server',
        "This isn't switched on yet. The database migration that enables it has not been applied.",
      )
    }

    return err('rate_limited', RATE_MESSAGES[action], retryAfter)
  }
  return ok(null)
}

// The windows must track check_rate_limit in the migration exactly — text is 5/10s,
// code 10/60s, reaction 30/60s, admin_login 5/60s, room 20/1h.
const RATE_WINDOWS: Record<'text' | 'code' | 'reaction' | 'admin_login' | 'room', number> = {
  text: 10,
  code: 60,
  reaction: 60,
  admin_login: 60,
  room: 60 * 60,
}

const RATE_MESSAGES: Record<keyof typeof RATE_WINDOWS, string> = {
  text: 'You are posting too fast. Wait a moment.',
  code: 'You are posting too fast. Wait a moment.',
  reaction: 'You are posting too fast. Wait a moment.',
  admin_login: 'You are posting too fast. Wait a moment.',
  room: 'You have created enough rooms for now. Wait a bit.',
}

async function rateWindow(
  hash: string,
  action: keyof typeof RATE_WINDOWS,
): Promise<{ retryAfter: number; recent: number }> {
  const db = getServiceClient()
  const windowSeconds = RATE_WINDOWS[action]

  // The oldest event still inside the window is what expires first; when it falls out,
  // one of the quota slots frees and the next post can go through. `count` is the size of
  // the whole filtered set, not the one row this limit returns — it is how an empty window
  // is told apart from a full one.
  const { data, count } = await db
    .from('rate_events')
    .select('created_at', { count: 'exact' })
    .eq('author_token_hash', hash)
    .eq('action', action)
    .gt('created_at', new Date(Date.now() - windowSeconds * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(1)

  const recent = count ?? 0
  const oldest = data?.[0]?.created_at
  if (!oldest) return { retryAfter: windowSeconds, recent }
  const remaining = new Date(oldest).getTime() + windowSeconds * 1000 - Date.now()
  return { retryAfter: Math.max(1, Math.ceil(remaining / 1000)), recent }
}

// Note: the former assertPostable(hash, groupId) helper was removed when admins gained
// the locked-room exemption. Composing ban + lock now requires knowing whether the
// poster is an admin, so app/actions/messages.ts owns that composition as
// assertPostableAs(). Call assertNotBanned and assertRoomOpen directly.

// Creating structure (department → year → batch → room) is open to anyone now, so the
// creator's identity is derived rather than required. An admin is recognised by the
// session cookie; an anonymous creator must present the same token the composer uses so
// the room can record who made it, and that identity pays for the write out of a shared
// hourly bucket. No role or admin flag is ever read from the client.
export type CreatorIdentity = { adminId: string | null; hash: string | null }

export async function creatorIdentity(
  token: string | undefined,
): Promise<ActionResult<CreatorIdentity>> {
  const session = await currentAdmin()
  if (session) return ok({ adminId: session.adminId, hash: null })

  const raw = token?.trim()
  if (!raw) return err('unauthorized', 'Refresh the page and try again.')

  const hash = hashToken(raw)
  const rate = await assertRateOk(hash, 'room')
  if (!rate.ok) return rate

  return ok({ adminId: null, hash })
}
