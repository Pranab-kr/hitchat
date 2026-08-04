'use client'

import { useEffect, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/browser'
import { MESSAGE_COLUMNS } from '@/lib/columns'
import type { Message } from '@/lib/types'

// INSERT and UPDATE only — never DELETE. Realtime cannot filter DELETE and does not
// apply RLS to it, so the bulk expiry purge would broadcast bare primary keys to every
// client in every room.
export function useRealtimeMessages(groupId: string, initial: Message[]) {
  const [messages, setMessages] = useState<Message[]>(initial)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    const supabase = getBrowserClient()
    let cancelled = false

    async function refetch() {
      const { data } = await supabase
        .from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(100)

      // The channel may already have been torn down by a groupId change; a late
      // response must not overwrite the new room's messages.
      // MESSAGE_COLUMNS is a runtime string, so PostgREST's inferred row type is
      // opaque here. The column list and lib/types.ts are kept in step by hand.
      if (data && !cancelled) setMessages((data as unknown as Message[]).reverse())
    }

    const channel = supabase
      .channel(`room:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const next = payload.new as Message
          setMessages((prev) =>
            prev.some((m) => m.id === next.id) ? prev : [...prev, next],
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const next = payload.new as Message
          setMessages((prev) => prev.map((m) => (m.id === next.id ? next : m)))
        },
      )
      .subscribe((status) => {
        if (cancelled) return
        setConnected(status === 'SUBSCRIBED')
        // Events during a disconnect are lost, so reconcile on every join. This covers
        // both first connect and reconnect with one path.
        if (status === 'SUBSCRIBED') void refetch()
      })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [groupId])

  return { messages, connected }
}
