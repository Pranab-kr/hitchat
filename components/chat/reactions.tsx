'use client'

import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { ReactionState } from '@/app/actions/reactions'

// The label is visible, never aria-only: a student who cannot hover (or cannot hear)
// must still learn what each glyph means. It matches the app's lowercase control voice
// and the accessible name, so screen readers announce exactly what is on screen.
const SET = [
  { key: 'works', glyph: '✓', label: 'works' },
  { key: 'buggy', glyph: '⚠', label: 'buggy' },
  { key: 'fire', glyph: '🔥', label: 'nice' },
  { key: 'eyes', glyph: '👀', label: 'looking' },
] as const

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
      {SET.map(({ key, glyph, label }) => {
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
              <span>{glyph}</span>
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
            <span>{glyph}</span>
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
