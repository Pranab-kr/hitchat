'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useReducedMotion } from 'motion/react'
import { useRealtimeMessages } from '@/lib/use-realtime-messages'
import { useReactions } from '@/lib/use-reactions'
import { useOwnMessages } from '@/lib/use-own-messages'
import { useNow } from '@/lib/use-now'
import { isNearBottom } from '@/lib/scroll'
import { MessageRow } from './message-row'
import { Composer } from './composer'
import { PinnedStrip } from '@/components/room/pinned-strip'
import { LabFilter } from '@/components/room/lab-filter'
import { RecordLine } from '@/components/room/record-line'
import { banAuthor } from '@/app/actions/moderation'
import { distinctLabTags, matchesLab } from '@/lib/labs'
import type { Message } from '@/lib/types'

export function MessageList({
  groupId,
  locked,
  initial,
  initialCodeHtml,
  isAdmin = false,
  adminRole = null,
  ownerAdminIds = [],
}: {
  groupId: string
  locked: boolean
  initial: Message[]
  initialCodeHtml: Record<string, string>
  isAdmin?: boolean
  adminRole?: 'owner' | 'co_admin' | null
  ownerAdminIds?: string[]
}) {
  const { messages, connected } = useRealtimeMessages(groupId, initial)
  const { reactionsFor, errorFor, isPendingFor, toggle } = useReactions(messages)
  const { isOwn } = useOwnMessages(messages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [labFilter, setLabFilter] = useState<string | null>(null)
  const [jumpedTo, setJumpedTo] = useState<string | null>(null)
  const [banTarget, setBanTarget] = useState<string | null>(null)
  const [banError, setBanError] = useState<string | null>(null)
  const [banPending, startBan] = useTransition()
  const banButtonRef = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()

  // Auto-scroll follows the newest message ONLY while the reader is already at the
  // bottom. The moment they scroll up into history, incoming posts stop yanking them
  // down and instead raise the "N new" pill. A ref keeps the scroll handler and the
  // insertion effect agreeing without a re-render between them.
  const stickToBottom = useRef(true)
  const prevLength = useRef(messages.length)
  const [newCount, setNewCount] = useState(0)

  // Land at the bottom on open, instantly — no rise-and-fade over a full page of
  // history on first paint.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [])

  useEffect(() => {
    const prev = prevLength.current
    prevLength.current = messages.length
    const added = messages.length - prev
    if (added <= 0) return

    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
    } else {
      setNewCount((c) => c + added)
    }
  }, [messages.length, reduce])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = isNearBottom(el)
    if (stickToBottom.current) setNewCount(0)
  }

  function jumpToLatest() {
    stickToBottom.current = true
    setNewCount(0)
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

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
  // Expiry is hidden client-side; the purge job removes the row later.
  const notExpired = messages.filter((m) => new Date(m.expires_at).getTime() > now)

  // Chips are derived live from the tags present. If the active tag's last message ages
  // out, fall back to All rather than stranding a phantom selection over an empty view.
  const labTags = distinctLabTags(notExpired)
  const activeLab = labFilter && labTags.includes(labFilter) ? labFilter : null

  const visible = notExpired.filter((m) => matchesLab(m, activeLab))

  // Reply previews and the pinned strip resolve against the whole room, never the
  // filtered view: a reply to a text message must still preview under a lab filter, and
  // an admin's pin must stay visible while a student filters the stream.
  const byId = new Map(notExpired.map((m) => [m.id, m]))

  // Derived from the live stream, never from a server prop: pin and unpin arrive as an
  // UPDATE over Realtime, so a strip seeded from props could never change.
  const pinned = notExpired.filter((m) => m.is_pinned && !m.deleted_at)

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

      <LabFilter tags={labTags} active={activeLab} onChange={setLabFilter} />

      {/* The dated top of the record sheet, right where the sheet's content begins. */}
      <RecordLine />

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

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* The stream is a log: role="log" announces newly arrived messages to a screen
            reader; aria-live="polite" makes the intent explicit without pre-empting the
            user. */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          className="h-full min-w-0 overflow-y-auto"
        >
          {!connected && (
            <div className="sticky top-0 bg-wash px-4 py-1 font-mono text-[12px] text-graphite" role="status">
              Reconnecting…
            </div>
          )}

          {visible.length === 0 ? (
            activeLab ? (
              <div className="px-4 py-8 text-[15px] leading-6 text-graphite">
                <p>No {activeLab} posts in the last 8 hours.</p>
                <button
                  type="button"
                  onClick={() => setLabFilter(null)}
                  className="mt-2 rounded-input font-mono text-[12px] text-pen transition-colors hover:underline"
                >
                  Show all messages
                </button>
              </div>
            ) : (
              <p className="px-4 py-8 text-[15px] text-graphite">
                Nothing here yet. Paste your lab code and someone will thank you.
              </p>
            )
          ) : (
            visible.map((message) => (
              // UI visibility is only a convenience. Server Actions enforce this same
              // owner-message boundary independently for every request.
              <MessageRow
                key={message.id}
                message={message}
                now={now}
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
                isOwn={isOwn(message.id)}
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

        {newCount > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            aria-label={`Jump to latest (${newCount} new ${newCount === 1 ? 'message' : 'messages'})`}
            title="Jump to the latest messages"
            className="touch-target absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 font-mono text-[12px] leading-4 text-pen shadow-sm transition-colors hover:bg-wash"
          >
            <span>{newCount} new</span>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="text-pen">
              <path
                d="M3 4.5 L6 7.5 L9 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
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
