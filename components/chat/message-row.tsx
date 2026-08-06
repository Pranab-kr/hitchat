'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ageOpacity } from '@/lib/age'
import { authorColorVar } from '@/lib/author-color'
import { useMounted } from '@/lib/use-mounted'
import { renderCode } from '@/app/actions/highlight'
import { CodeCard } from './code-card'
import { Reactions } from './reactions'
import { AdminControls } from './admin-controls'
import type { Message } from '@/lib/types'
import type { ReactionState } from '@/app/actions/reactions'

export function MessageRow({
  message,
  codeHtml: initialCodeHtml = null,
  replyTo = null,
  reactions,
  reactionError = null,
  reactionPending = false,
  onToggleReaction,
  onReply,
  onJumpTo,
  isAdmin = false,
  canModerate = true,
  onBan,
  highlighted = false,
  children,
}: {
  message: Message
  codeHtml?: string | null
  replyTo?: Message | null
  reactions?: ReactionState
  reactionError?: string | null
  reactionPending?: boolean
  onToggleReaction?: (messageId: string, emoji: string) => void
  onReply?: (message: Message) => void
  onJumpTo?: (messageId: string) => void
  isAdmin?: boolean
  canModerate?: boolean
  onBan?: (messageId: string) => void
  highlighted?: boolean
  children?: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const mounted = useMounted()
  const [codeHtml, setCodeHtml] = useState(initialCodeHtml)

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

  if (message.deleted_at) {
    return (
      <div className="px-4 py-1 font-mono text-[12px] text-graphite">message deleted</div>
    )
  }

  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <motion.div
      id={`m-${message.id}`}
      // The enter animation only applies once mounted. Server-rendering
      // `opacity: 0` leaves every message invisible until JS hydrates — and
      // permanently invisible if it never does.
      initial={mounted ? (reduce ? { opacity: 0 } : { opacity: 0, y: 8 }) : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`group px-4 py-1 transition-colors ${highlighted ? 'bg-pen/8' : ''}`}
    >
      {message.reply_to_id && (
        <button
          type="button"
          onClick={() => onJumpTo?.(message.reply_to_id!)}
          className="mb-1 flex max-w-full items-center gap-2 border-l-2 border-hairline pl-2 text-left font-mono text-[12px] text-graphite transition-colors hover:text-pen"
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
            className="rounded-[4px] px-1.5 py-0.5 font-mono text-[12px] text-graphite transition-opacity hover:bg-wash hover:text-pen md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
          >
            reply
          </button>
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
          style={{ opacity: ageOpacity(message.created_at) }}
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
}
