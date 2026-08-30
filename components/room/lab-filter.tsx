'use client'

import { useRef } from 'react'

// The record-sheet's tab labels: "All · Lab 3 · Lab 4", dot-separated and quiet, active
// in pen — not filled pills. Single-select, so a real radiogroup with roving tabindex and
// arrow-key movement. Renders nothing until the room actually has a tagged post.
export function LabFilter({
  tags,
  active,
  onChange,
}: {
  tags: string[]
  active: string | null
  onChange: (tag: string | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  if (tags.length === 0) return null

  const values: (string | null)[] = [null, ...tags]

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const index = Math.max(0, values.indexOf(active))
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + delta + values.length) % values.length
    onChange(values[next])
    ref.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Filter by lab"
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-y-0.5 border-b border-hairline px-4 py-2"
    >
      {values.map((value, index) => {
        const selected = active === value
        return (
          <span key={value ?? '__all'} className="flex items-center">
            {index > 0 && (
              <span aria-hidden className="select-none px-0.5 font-mono text-[12px] text-graphite/50">
                ·
              </span>
            )}
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(value)}
              className={`touch-target rounded-input px-1.5 py-0.5 font-mono text-[12px] leading-4 tracking-[0.02em] transition-colors ${
                selected ? 'font-medium text-pen' : 'text-graphite hover:text-ink'
              }`}
            >
              {value ?? 'All'}
            </button>
          </span>
        )
      })}
    </div>
  )
}
