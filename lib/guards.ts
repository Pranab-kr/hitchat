import 'server-only'
import { getServiceClient } from '@/lib/supabase/admin'
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
  action: 'text' | 'code' | 'reaction' | 'admin_login',
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
    const retryAfter = await rateLimitRetryAfter(hash, action)
    return err('rate_limited', 'You are posting too fast. Wait a moment.', retryAfter)
  }
  return ok(null)
}

// The windows must track check_rate_limit in the migration exactly — text is 5/10s,
// code 3/60s, reaction 30/60s, admin_login 5/60s.
const RATE_WINDOWS: Record<'text' | 'code' | 'reaction' | 'admin_login', number> = {
  text: 10,
  code: 60,
  reaction: 60,
  admin_login: 60,
}

async function rateLimitRetryAfter(hash: string, action: keyof typeof RATE_WINDOWS): Promise<number> {
  const db = getServiceClient()
  const windowSeconds = RATE_WINDOWS[action]

  // The oldest event still inside the window is what expires first; when it falls out,
  // one of the quota slots frees and the next post can go through.
  const { data } = await db
    .from('rate_events')
    .select('created_at')
    .eq('author_token_hash', hash)
    .eq('action', action)
    .gt('created_at', new Date(Date.now() - windowSeconds * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(1)

  const oldest = data?.[0]?.created_at
  if (!oldest) return windowSeconds
  const remaining = new Date(oldest).getTime() + windowSeconds * 1000 - Date.now()
  return Math.max(1, Math.ceil(remaining / 1000))
}

// Note: the former assertPostable(hash, groupId) helper was removed when admins gained
// the locked-room exemption. Composing ban + lock now requires knowing whether the
// poster is an admin, so app/actions/messages.ts owns that composition as
// assertPostableAs(). Call assertNotBanned and assertRoomOpen directly.
