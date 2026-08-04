'use client'

import { useEffect, useRef } from 'react'
import { useRealtimeMessages } from '@/lib/use-realtime-messages'
import { useNow } from '@/lib/use-now'
import { MessageRow } from './message-row'
import type { Message } from '@/lib/types'

export function MessageList({
  groupId,
  initial,
  initialCodeHtml,
  labFilter,
}: {
  groupId: string
  initial: Message[]
  initialCodeHtml: Record<string, string>
  labFilter: string | null
}) {
  const { messages, connected } = useRealtimeMessages(groupId, initial)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const now = useNow()
  const visible = messages
    // Expiry is hidden client-side; the purge job removes the row later.
    .filter((m) => new Date(m.expires_at).getTime() > now)
    .filter((m) => !labFilter || m.lab_tag === labFilter)

  return (
    <div className="flex-1 overflow-y-auto">
      {!connected && (
        <div className="sticky top-0 bg-wash px-4 py-1 font-mono text-[12px] text-graphite">
          Reconnecting…
        </div>
      )}

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-[15px] text-graphite">
          Nothing here yet. Paste your lab code and someone will thank you.
        </p>
      ) : (
        visible.map((message) => (
          <MessageRow
            key={message.id}
            message={message}
            codeHtml={initialCodeHtml[message.id] ?? null}
          />
        ))
      )}

      <div ref={bottomRef} />
    </div>
  )
}
