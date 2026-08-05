'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRealtimeMessages } from '@/lib/use-realtime-messages'
import { useReactions } from '@/lib/use-reactions'
import { useNow } from '@/lib/use-now'
import { MessageRow } from './message-row'
import { Composer } from './composer'
import type { Message } from '@/lib/types'

export function MessageList({
  groupId,
  locked,
  initial,
  initialCodeHtml,
  labFilter,
}: {
  groupId: string
  locked: boolean
  initial: Message[]
  initialCodeHtml: Record<string, string>
  labFilter: string | null
}) {
  const { messages, connected } = useRealtimeMessages(groupId, initial)
  const { reactionsFor, errorFor, toggle } = useReactions(messages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [jumpedTo, setJumpedTo] = useState<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const jumpTo = useCallback((messageId: string) => {
    document.getElementById(`m-${messageId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    setJumpedTo(messageId)
  }, [])

  useEffect(() => {
    if (!jumpedTo) return
    const timer = setTimeout(() => setJumpedTo(null), 1600)
    return () => clearTimeout(timer)
  }, [jumpedTo])

  const now = useNow()
  const visible = messages
    // Expiry is hidden client-side; the purge job removes the row later.
    .filter((m) => new Date(m.expires_at).getTime() > now)
    .filter((m) => !labFilter || m.lab_tag === labFilter)

  // A reply target that expired or was deleted leaves the preview reading
  // "original message expired" rather than silently dropping the quote.
  const byId = new Map(visible.map((m) => [m.id, m]))

  return (
    <>
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
              replyTo={
                message.reply_to_id ? (byId.get(message.reply_to_id) ?? null) : null
              }
              reactions={reactionsFor(message.id)}
              reactionError={errorFor(message.id)}
              onToggleReaction={toggle}
              onReply={locked ? undefined : setReplyTo}
              onJumpTo={jumpTo}
              highlighted={jumpedTo === message.id}
            />
          ))
        )}

        <div ref={bottomRef} />
      </div>

      <Composer
        groupId={groupId}
        locked={locked}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />
    </>
  )
}
