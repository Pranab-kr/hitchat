'use client'

import { useState } from 'react'
import { authorColorVar } from '@/lib/author-color'
import { AuthorMark } from '@/components/chat/author-mark'
import type { Message } from '@/lib/types'

// marigold appears here and on the SUDO badge only. design.md line 107.
export function PinnedStrip({
  pinned,
  onJumpTo,
}: {
  pinned: Message[]
  onJumpTo?: (messageId: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (pinned.length === 0) return null

  // A pinned code post has raw source as its body; a one-line preview of that is noise.
  const preview = (m: Message) => (m.kind === 'code' ? (m.code_title ?? 'code') : m.body)

  return (
    // marigold carries the signal as a border and wash — both UI surfaces, which answer
    // to the 3.0 floor — while the label itself is `ink`. Marigold text on the light
    // paper measures 1.72:1 against a 4.5 floor. Same fix Task 10 applied to /sudo:
    // keep the color as a non-text indicator rather than inventing a new one.
    <div className="border-b border-hairline border-l-2 border-l-marigold bg-marigold/8 px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="touch-target flex w-full items-center gap-2 text-left"
      >
        <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-ink">
          PINNED
        </span>
        {!open && (
          <span className="truncate text-[13px] text-ink">{preview(pinned[0])}</span>
        )}
        <span className="ml-auto shrink-0 font-mono text-[12px] text-graphite">
          {open ? '⌃' : `⌄ ${pinned.length}`}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {pinned.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onJumpTo?.(m.id)}
              className="touch-target flex w-full items-baseline gap-2 rounded-[4px] px-1 py-0.5 text-left transition-colors hover:bg-wash"
            >
              {/* Never the stored hex: it is the light column and fails AA on dark. */}
              <AuthorMark color={m.author_color} className="shrink-0 self-center" />
              <span
                className="shrink-0 font-mono text-[12px]"
                style={{ color: authorColorVar(m.author_color) }}
              >
                {m.author_name}
              </span>
              <span className="truncate text-[13px] text-ink">{preview(m)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
