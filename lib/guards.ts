import 'server-only'
import { getServiceClient } from '@/lib/supabase/admin'
import { type ActionResult, ok, err } from '@/lib/result'

export async function assertNotBanned(hash: string): Promise<ActionResult<null>> {
  const db = getServiceClient()
  const { data } = await db
    .from('bans')
    .select('until')
    .eq('author_token_hash', hash)
    .gt('until', new Date().toISOString())
    .maybeSingle()

  if (data) {
    const until = new Date(data.until).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
    return err('banned', `You can't post here until ${until}.`)
  }
  return ok(null)
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
    return err('rate_limited', 'You are posting too fast. Wait a moment.', 10)
  }
  return ok(null)
}

export async function assertPostable(
  hash: string,
  groupId: string,
): Promise<ActionResult<null>> {
  const banned = await assertNotBanned(hash)
  if (!banned.ok) return banned

  const open = await assertRoomOpen(groupId)
  if (!open.ok) return open

  return ok(null)
}
