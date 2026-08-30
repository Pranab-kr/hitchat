'use client'

import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { ReactionState } from '@/app/actions/reactions'

// The label is visible, never aria-only: a student who cannot hover (or cannot hear)
// must still learn what each glyph means. It matches the app's lowercase control voice
// and the accessible name, so screen readers announce exactly what is on screen.
const SET = [
  { key: 'works', label: 'works', Glyph: WorksMark },
  { key: 'buggy', label: 'buggy', Glyph: BuggyMark },
  { key: 'fire', label: 'nice', Glyph: FireMark },
  { key: 'eyes', label: 'looking', Glyph: EyesMark },
] as const

// The four marks are drawn SVGs in currentColor, one stroked family with the copy and
// chevron icons. The strict six-token palette allows no uncontrolled color in the room,
// and the craft floor bans emoji standing in for an icon system — so no unicode ✓ ⚠ or
// 🔥 👀 here. The button's aria-label does the announcing; the mark stays decorative.
function WorksMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-[12px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.2 8.4 6.4 11.6 12.8 4.4" />
    </svg>
  )
}

function BuggyMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-[12px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M8 2.6 14.2 13.4H1.8L8 2.6Z" />
      <path d="M8 6.5v3" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FireMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-[12px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M8.2 2.4c.6 2.1 3.1 3.5 3.1 6.3a3.3 3.3 0 0 1-6.6 0c0-2.8 2.5-4.2 3.5-6.3Z" />
      <path d="M8.2 12.8a3.3 3.3 0 0 1-2.6-4.7" strokeLinecap="round" />
    </svg>
  )
}

function EyesMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-[12px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M3.4 8.2c1-1.7 3-1.7 4 0-1 1.7-3 1.7-4 0Z" />
      <path d="M9.4 8.2c1-1.7 3-1.7 4 0-1 1.7-3 1.7-4 0Z" />
      <circle cx="5.4" cy="8.2" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="11.4" cy="8.2" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Reactions({
  messageId,
  state,
  error,
  pending,
  onToggle,
}: {
  messageId: string
  state: ReactionState
  error: string | null
  pending: boolean
  onToggle: (messageId: string, emoji: string) => void
}) {
  const reduce = useReducedMotion()

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {SET.map(({ key, label, Glyph }) => {
        const count = state.counts[key] ?? 0
        const active = state.mine.includes(key)

        if (count === 0 && !active) {
          return (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => onToggle(messageId, key)}
              aria-label={label}
              className="touch-target flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[12px] leading-[16px] text-ink transition-opacity hover:bg-wash disabled:opacity-40 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
            >
              <span>
                <Glyph />
              </span>
              <span>{label}</span>
            </button>
          )
        }

        return (
          <motion.button
            key={key}
            type="button"
            disabled={pending}
            onClick={() => onToggle(messageId, key)}
            aria-label={`${label}, ${count}`}
            aria-pressed={active}
            whileTap={reduce ? undefined : { scale: 1.15 }}
            transition={{ type: 'spring', duration: 0.2 }}
            className={cn(
              'touch-target flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-mono text-[12px] leading-[16px] disabled:opacity-40',
              active ? 'bg-pen/12 text-pen' : 'bg-wash text-graphite',
            )}
          >
            <span>
              <Glyph />
            </span>
            <span>{label}</span>
            <span>{count}</span>
          </motion.button>
        )
      })}

      {error && (
        <span className="ml-1 font-mono text-[12px] text-rule" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
