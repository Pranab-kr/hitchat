'use client'

import { useEffect, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/browser'

// Each tab tracks a random key — the anon token is not used here since presence
// is ephemeral and per-tab, and we must never broadcast the hashed token.
function randomVisitorId() {
  return Math.random().toString(36).slice(2)
}

export function useOnlineCount(groupId: string): number {
  const [count, setCount] = useState(1)

  useEffect(() => {
    const supabase = getBrowserClient()
    const visitorId = randomVisitorId()

    const channel = supabase.channel(`presence:${groupId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        setCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ visitorId })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [groupId])

  return count
}
