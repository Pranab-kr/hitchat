'use client'

import { useEffect, useState } from 'react'
import { getOwnMessageIds } from '@/app/actions/me'
import { useAnonToken } from '@/lib/use-anon-token'

// Mirrors useReactions: the client cannot compute its own hash, so a batch of ids goes
// to the server and comes back tagged "yours". Refetches when the identity rerolls,
// so a new identity stops owning the old messages.
export function useOwnMessages(messages: { id: string }[]) {
  const { token } = useAnonToken()
  const [mine, setMine] = useState<ReadonlySet<string>>(() => new Set())

  const recent = messages.slice(-100)
  const idsKey = recent.map((m) => m.id).join(',')

  useEffect(() => {
    if (!token || !idsKey) return
    const ids = idsKey.split(',')
    let alive = true

    void getOwnMessageIds({ token, messageIds: ids }).then((result) => {
      if (alive && result.ok) setMine(new Set(result.data.ids))
    })

    return () => {
      alive = false
    }
  }, [token, idsKey])

  return { isOwn: (id: string) => mine.has(id) }
}
