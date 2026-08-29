'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useReducedMotion } from 'motion/react'
import { useRealtimeMessages } from '@/lib/use-realtime-messages'
import { useReactions } from '@/lib/use-reactions'
import { useNow } from '@/lib/use-now'
import { MessageRow } from './message-row'
import { Composer } from './composer'
import { PinnedStrip } from '@/components/room/pinned-strip'
import { banAuthor } from '@/app/actions/moderation'
import type { Message } from '@/lib/types'

export function MessageList({
  groupId,
  locked,
  initial,
  initialCodeHtml,
  labFilter,
  isAdmin = false,
  adminRole = null,
  ownerAdminIds = [],
}: {
  groupId: string
  locked: boolean
  initial: Message[]
  initialCodeHtml: Record<string, string>
  labFilter: string | null
  isAdmin?: boolean
  adminRole?: 'owner' | 'co_admin' | null
  ownerAdminIds?: string[]
}) {
  const { messages, connected } = useRealtimeMessages(groupId, initial)
  const { reactionsFor, errorFor, isPendingFor, toggle } = useReactions(messages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [jumpedTo, setJumpedTo] = useState<string | null>(null)
  const [banTarget, setBanTarget] = useState<string | null>(null)
  const [banError, setBanError] = useState<string | null>(null)
  const [banPending, startBan] = useTransition()
  const banButtonRef = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }, [messages.length, reduce])

  // The ban confirm is an inline bar, not a modal dialog — so it gets a region, not
  // alertdialog (whose focus-management promises it cannot keep), and focus lands on
  // the confirm button so a keyboard user does not have to hunt for it.
  useEffect(() => {
    if (banTarget) banButtonRef.current?.focus()
  }, [banTarget])

  const jumpTo = useCallback(
    (messageId: string) => {
      document.getElementById(`m-${messageId}`)?.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'center',
      })
      setJumpedTo(messageId)
    },
    [reduce],
  )

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

  // Derived from the live stream, never from a server prop: pin and unpin arrive as an
  // UPDATE over Realtime, so a strip seeded from props could never change.
  const pinned = visible.filter((m) => m.is_pinned && !m.deleted_at)

  function confirmBan() {
    if (!banTarget) return
    startBan(async () => {
      const result = await banAuthor(banTarget)
      if (result.ok) {
        setBanTarget(null)
        setBanError(null)
      } else {
        setBanError(result.message)
      }
    })
  }

  return (
    <>
      <PinnedStrip pinned={pinned} onJumpTo={jumpTo} />

      {banTarget && (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-hairline bg-wash px-4 py-2 font-mono text-[12px] text-ink"
          role="region"
          aria-label="Confirm ban"
        >
          <span>Ban this person for 24 hours?</span>
          <button
            ref={banButtonRef}
            type="button"
            disabled={banPending}
            onClick={confirmBan}
            className="touch-target rounded-input px-2 py-1 text-rule transition-colors hover:bg-rule/10 disabled:opacity-40"
          >
            ban
          </button>
          <button
            type="button"
            disabled={banPending}
            onClick={() => {
              setBanTarget(null)
              setBanError(null)
            }}
            className="touch-target rounded-input px-2 py-1 text-graphite transition-colors hover:text-ink disabled:opacity-40"
          >
            cancel
          </button>
          {banError && (
            <span className="text-rule" role="alert">
              {banError}
            </span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!connected && (
          <div className="sticky top-0 bg-wash px-4 py-1 font-mono text-[12px] text-graphite" role="status">
            Reconnecting…
          </div>
        )}

        {visible.length === 0 ? (
          <p className="px-4 py-8 text-[15px] text-graphite">
            Nothing here yet. Paste your lab code and someone will thank you.
          </p>
        ) : (
          visible.map((message) => (
            // UI visibility is only a convenience. Server Actions enforce this same
            // owner-message boundary independently for every request.
            <MessageRow
              key={message.id}
              message={message}
              codeHtml={initialCodeHtml[message.id] ?? null}
              replyTo={
                message.reply_to_id ? (byId.get(message.reply_to_id) ?? null) : null
              }
              reactions={reactionsFor(message.id)}
              reactionError={errorFor(message.id)}
              reactionPending={isPendingFor(message.id)}
              onToggleReaction={toggle}
              onReply={locked && !isAdmin ? undefined : setReplyTo}
              onJumpTo={jumpTo}
              isAdmin={isAdmin}
              canModerate={
                adminRole === 'owner' ||
                !message.admin_id ||
                !ownerAdminIds.includes(message.admin_id)
              }
              onBan={setBanTarget}
              highlighted={jumpedTo === message.id}
            />
          ))
        )}

        <div ref={bottomRef} />
      </div>

      <Composer
        groupId={groupId}
        locked={locked}
        isAdmin={isAdmin}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />
    </>
  )
}
