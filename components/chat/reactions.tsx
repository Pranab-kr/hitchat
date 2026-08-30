'use client'

import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { ReactionState } from '@/app/actions/reactions'

const SET = [
  { key: 'works', label: 'works', mark: '✅' },
  { key: 'buggy', label: 'buggy', mark: '⚠️' },
  { key: 'fire', label: 'nice', mark: '🔥' },
  { key: 'eyes', label: 'looking', mark: '👀' },
] as const

// The mark is decorative and the accessible button name carries its meaning, so the
// familiar emoji can stay visually compact without making screen-reader output noisy.
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
      {SET.map(({ key, label, mark }) => {
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
              <span aria-hidden="true">{mark}</span>
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
              'touch-target flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[12px] leading-[16px] disabled:opacity-40',
              active ? 'bg-pen/12 text-pen' : 'bg-wash text-graphite',
            )}
          >
            <span aria-hidden="true">{mark}</span>
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
