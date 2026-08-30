'use client'

import { memo, useEffect, useState, useTransition } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useTheme } from 'next-themes'
import { ageOpacity } from '@/lib/age'
import { authorColorVar } from '@/lib/author-color'
import { useMounted } from '@/lib/use-mounted'
import { useAnonToken } from '@/lib/use-anon-token'
import { withinSelfDeleteWindow } from '@/lib/self-delete'
import { renderCode } from '@/app/actions/highlight'
import { deleteOwnMessage } from '@/app/actions/messages'
import { CodeCard } from './code-card'
import { Reactions } from './reactions'
import { AdminControls } from './admin-controls'
import type { Message } from '@/lib/types'
import type { ReactionState } from '@/app/actions/reactions'

export const MessageRow = memo(function MessageRow({
  message,
  now,
  codeHtml: initialCodeHtml = null,
  replyTo = null,
  reactions,
  reactionError = null,
  reactionPending = false,
  onToggleReaction,
  onReply,
  onJumpTo,
  isAdmin = false,
  isOwn = false,
  canModerate = true,
  onBan,
  highlighted = false,
  children,
}: {
  message: Message
  now: number
  codeHtml?: string | null
  replyTo?: Message | null
  reactions?: ReactionState
  reactionError?: string | null
  reactionPending?: boolean
  onToggleReaction?: (messageId: string, emoji: string) => void
  onReply?: (message: Message) => void
  onJumpTo?: (messageId: string) => void
  isAdmin?: boolean
  isOwn?: boolean
  canModerate?: boolean
  onBan?: (messageId: string) => void
  highlighted?: boolean
  children?: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const mounted = useMounted()
  const { resolvedTheme } = useTheme()
  const { token } = useAnonToken()
  const [codeHtml, setCodeHtml] = useState(initialCodeHtml)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletePending, startDelete] = useTransition()

  const isCode = message.kind === 'code' && !message.deleted_at
  const needsHighlight = isCode && codeHtml === null

  useEffect(() => {
    // Only for messages that arrived over Realtime; the first 100 are highlighted on
    // the server so they are readable before hydration and without JS.
    if (!needsHighlight) return
    let alive = true
    void renderCode(message.body, message.code_lang ?? 'plaintext').then((html) => {
      if (alive) setCodeHtml(html)
    })
    return () => {
      alive = false
    }
  }, [needsHighlight, message.body, message.code_lang])

  function handleSelfDelete() {
    if (!token) return
    startDelete(async () => {
      const result = await deleteOwnMessage({ token, messageId: message.id })
      setDeleteError(result.ok ? null : result.message)
    })
  }

  if (message.deleted_at) {
    return (
      <div className="px-4 py-1 font-mono text-[12px] text-graphite">message deleted</div>
    )
  }

  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // The retract is the author's, so it is hidden for moderators who already have the
  // admin delete — two identical "delete" controls on one row is noise. The server
  // re-verifies ownership and the 5-minute window on every call regardless.
  const canSelfDelete = isOwn && !(isAdmin && canModerate) && withinSelfDeleteWindow(message.created_at, now)

  return (
    <motion.div
      id={`m-${message.id}`}
      // The enter animation only applies once mounted. Server-rendering
      // `opacity: 0` leaves every message invisible until JS hydrates — and
      // permanently invisible if it never does.
      initial={mounted ? (reduce ? { opacity: 0 } : { opacity: 0, y: 8 }) : false}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
      className={`group px-4 py-1 transition-colors ${highlighted ? 'bg-pen/8' : ''}`}
    >
      {message.reply_to_id && (
        <button
          type="button"
          onClick={() => onJumpTo?.(message.reply_to_id!)}
          className="touch-target mb-1 flex max-w-full items-center gap-2 border-l-2 border-hairline pl-2 text-left font-mono text-[12px] text-graphite transition-colors hover:text-pen"
        >
          {replyTo ? (
            <>
              {/* Never the stored hex: author_color is the light column and all eight
                  fail WCAG AA on the dark background. */}
              <span style={{ color: authorColorVar(replyTo.author_color) }}>
                {replyTo.author_name}
              </span>
              <span className="truncate">
                {replyTo.kind === 'code' ? 'code' : replyTo.body}
              </span>
            </>
          ) : (
            <span>original message expired</span>
          )}
        </button>
      )}

      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className="font-mono text-[12px] tracking-[0.02em]"
          style={{ color: authorColorVar(message.author_color) }}
        >
          {message.author_name}
        </span>

        {message.admin_id && (
          // marigold text on its own 12% wash measures 1.57:1 on the light paper,
          // against a 4.5 floor. design.md § Component notes prescribes this
          // border-plus-wash form instead: marigold stays as a UI surface (3.0 floor)
          // and the label is ink. Same recipe as AdminBar and PinnedStrip.
          <span className="rounded-[4px] border-l-2 border-l-marigold bg-marigold/12 px-1.5 py-0.5 font-mono text-[11px] tracking-[0.08em] text-ink">
            SUDO
          </span>
        )}

        <time
          dateTime={message.created_at}
          className="font-mono text-[12px] text-graphite"
        >
          {time}
        </time>

        {onReply && (
          <button
            type="button"
            onClick={() => onReply(message)}
            className="touch-target rounded-[4px] px-1.5 py-0.5 font-mono text-[12px] text-graphite transition-opacity hover:bg-wash hover:text-pen [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
          >
            reply
          </button>
        )}

        {canSelfDelete && (
          <button
            type="button"
            disabled={deletePending}
            onClick={handleSelfDelete}
            className="touch-target rounded-[4px] px-1.5 py-0.5 font-mono text-[12px] text-graphite transition-opacity hover:bg-wash hover:text-rule disabled:opacity-40 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
          >
            delete
          </button>
        )}

        {deleteError && (
          <span className="font-mono text-[12px] text-rule" role="alert">
            {deleteError}
          </span>
        )}

        {isAdmin && canModerate && (
          <AdminControls
            messageId={message.id}
            isPinned={message.is_pinned}
            onBan={onBan}
          />
        )}
      </div>

      {/* Code bodies never fade — someone copying an 18-hour-old answer needs to read it
          perfectly. Only text ages. */}
      {isCode ? (
        <CodeCard
          code={message.body}
          html={codeHtml}
          lang={message.code_lang ?? 'plaintext'}
          title={message.code_title}
          labTag={message.lab_tag}
        />
      ) : (
        <div
          className="text-[15px] leading-[24px] break-words whitespace-pre-wrap text-ink"
          style={{ opacity: ageOpacity(message.created_at, now, resolvedTheme === 'dark') }}
        >
          {children ?? message.body}
        </div>
      )}

      {reactions && onToggleReaction && (
        <Reactions
          messageId={message.id}
          state={reactions}
          error={reactionError}
          pending={reactionPending}
          onToggle={onToggleReaction}
        />
      )}
    </motion.div>
  )
})
