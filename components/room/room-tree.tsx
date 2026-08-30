'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { ordinal, type DeptNode } from '@/lib/rooms'

export type CurrentRoom = { deptSlug: string; year: number; batch: number; group: string }

// The notebook index. Rendered both in the desktop rail and inside the mobile drawer, so
// it owns its own expand/collapse state and takes an optional `onNavigate` the drawer
// uses to close itself on a room change.
export function RoomTree({
  tree,
  current,
  onNavigate,
}: {
  tree: DeptNode[]
  current: CurrentRoom
  onNavigate?: () => void
}) {
  const currentBatchKey = `${current.deptSlug}/${current.year}/${current.batch}`
  // Only the current room's batch is open on load; its siblings stay collapsed so the
  // index reads as a table of contents, not a wall.
  const [open, setOpen] = useState<Set<string>>(() => new Set([currentBatchKey]))

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="flex h-full w-full flex-col">
      <nav aria-label="Rooms" className="flex-1 overflow-y-auto px-2 py-3">
        {tree.map((dept) => (
          <div key={dept.id} className="mb-4 last:mb-0">
            <p className="truncate px-2 pb-0.5 text-[13px] leading-5 font-semibold text-ink" title={dept.name}>
              {dept.name}
            </p>

            {dept.years.map((year) => (
              <div key={year.number} className="mt-1">
                <p className="px-2 py-0.5 font-mono text-[11px] leading-4 tracking-[0.08em] text-graphite uppercase">
                  {ordinal(year.number)} year
                </p>

                {year.batches.map((batch) => {
                  const key = `${dept.slug}/${year.number}/${batch.number}`
                  const isOpen = open.has(key)
                  return (
                    <div key={batch.number}>
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                        className="touch-target flex w-full items-center gap-1.5 rounded-input px-2 py-1 text-left text-[13px] leading-5 text-ink transition-colors hover:bg-wash"
                      >
                        <Chevron open={isOpen} />
                        <span className="truncate">Batch {batch.number}</span>
                      </button>

                      {isOpen && (
                        <ul>
                          {batch.groups.map((group) => {
                            const isCurrent =
                              dept.slug === current.deptSlug &&
                              year.number === current.year &&
                              batch.number === current.batch &&
                              group.label === current.group
                            return (
                              <li key={group.label}>
                                <Link
                                  href={`/c/${dept.slug}/${year.number}/${batch.number}/${group.label.toLowerCase()}`}
                                  prefetch
                                  onClick={onNavigate}
                                  aria-current={isCurrent ? 'page' : undefined}
                                  className={`touch-target flex items-center gap-2 rounded-input py-1 pr-2 pl-[26px] text-[13px] leading-5 transition-colors ${
                                    isCurrent
                                      ? 'bg-wash font-medium text-pen'
                                      : 'text-ink hover:bg-wash'
                                  }`}
                                >
                                  <span
                                    aria-hidden
                                    className={`size-1.5 shrink-0 rounded-full ${isCurrent ? 'bg-pen' : 'bg-transparent'}`}
                                  />
                                  <span className="truncate">{group.label}</span>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-hairline px-3 py-2">
        <span className="font-mono text-[11px] leading-4 tracking-[0.02em] text-graphite">
          vanishes in 8h
        </span>
        <ThemeToggle />
      </div>
    </div>
  )
}

// Drawn, not a glyph: a single chevron stroke that rotates from ▸ to ▾ on expand.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden
      className={`shrink-0 text-graphite transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path
        d="M4.5 3 L8 6 L4.5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
