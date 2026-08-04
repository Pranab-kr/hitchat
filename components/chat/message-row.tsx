'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ageOpacity } from '@/lib/age'
import { authorColorVar } from '@/lib/author-color'
import { useMounted } from '@/lib/use-mounted'
import { renderCode } from '@/app/actions/highlight'
import { CodeCard } from './code-card'
import type { Message } from '@/lib/types'

export function MessageRow({
  message,
  codeHtml: initialCodeHtml = null,
  children,
}: {
  message: Message
  codeHtml?: string | null
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
      // The enter animation only applies once mounted. Server-rendering
      // `opacity: 0` leaves every message invisible until JS hydrates — and
      // permanently invisible if it never does.
      initial={mounted ? (reduce ? { opacity: 0 } : { opacity: 0, y: 8 }) : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="px-4 py-1"
    >
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-[12px] tracking-[0.02em]"
          style={{ color: authorColorVar(message.author_color) }}
        >
          {message.author_name}
        </span>

        {message.admin_id && (
          <span className="rounded-[4px] bg-marigold/12 px-1.5 py-0.5 font-mono text-[11px] tracking-[0.08em] text-marigold">
            SUDO
          </span>
        )}

        <time
          dateTime={message.created_at}
          className="font-mono text-[12px] text-graphite"
        >
          {time}
        </time>
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
    </motion.div>
  )
}
