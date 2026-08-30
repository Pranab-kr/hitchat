'use client'

import { useEffect, useRef, useState } from 'react'
import { RoomTree, type CurrentRoom } from './room-tree'
import type { DeptNode } from '@/lib/rooms'

// The room index on < 768px: a hamburger in the header opens the same tree as a left
// drawer. The desktop rail is a separate always-on `<aside>` in the page, so this
// component is the ONLY thing that renders below `md`.
export function MobileRoomNav({ tree, current }: { tree: DeptNode[]; current: CurrentRoom }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    // The hamburger is always mounted, so capturing it now is safe and satisfies the
    // ref-in-cleanup rule; focus returns to it when the drawer closes.
    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first control in the panel; restore focus to the trigger on close.
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panel) return
      // Trap Tab within the panel while it is modal.
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open rooms"
        aria-expanded={open}
        className="touch-target -ml-1 flex size-9 items-center justify-center rounded-input text-graphite transition-colors hover:bg-wash hover:text-ink md:hidden"
      >
        <MenuIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Rooms">
          {/* An inked veil over the stream, not a modal card — clicking it closes. */}
          <button
            type="button"
            aria-label="Close rooms"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div
            ref={panelRef}
            className="absolute inset-y-0 left-0 flex w-[260px] max-w-[82%] flex-col border-r border-hairline bg-paper"
          >
            <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
              <span className="font-mono text-[11px] leading-4 tracking-[0.08em] text-graphite uppercase">
                Rooms
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close rooms"
                className="touch-target flex size-8 items-center justify-center rounded-input text-graphite transition-colors hover:bg-wash hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <RoomTree tree={tree} current={current} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <path
        d="M3 6h14M3 10h14M3 14h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
      <path
        d="M5 5l10 10M15 5L5 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
