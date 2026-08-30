'use client'

import { authorIndex, authorColorVar } from '@/lib/author-color'

// The non-color half of an author's identity. Color tells speakers apart in a busy
// stream; color alone stops working for a color-blind reader. Each of the eight slots
// gets its own drawn glyph (never a unicode codepoint — the tofu rule), rendered in
// the slot's color so the shape and the color always travel together. The same mark
// appears beside the handle, in the reply preview, and in the pinned strip, so one
// author reads the same everywhere.
const MARKS = [
  <circle key="circle" cx="5" cy="5" r="3.4" fill="currentColor" />,
  <rect key="square" x="1.7" y="1.7" width="6.6" height="6.6" rx="0.4" fill="currentColor" />,
  <path key="triangle" d="M5 1.8 8.2 8.2H1.8Z" fill="currentColor" />,
  <path key="diamond" d="m5 1.8 3.2 3.2L5 8.2 1.8 5Z" fill="currentColor" />,
  <path key="plus" d="M4.1 1.6h1.8v2.5h2.5v1.8H5.9v2.5H4.1V5.9H1.6V4.1h2.5Z" fill="currentColor" />,
  <path key="hexagon" d="M5 1.8l2.9 1.6v3.2L5 8.2l-2.9-1.6V3.4Z" fill="currentColor" />,
  <circle key="ring" cx="5" cy="5" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7" />,
  <path key="spark" d="M5 1.5l.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8Z" fill="currentColor" />,
]

export function AuthorMark({
  color,
  size = 10,
  className,
}: {
  color: string
  size?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 10 10"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={{ color: authorColorVar(color) }}
    >
      {MARKS[authorIndex(color)]}
    </svg>
  )
}
