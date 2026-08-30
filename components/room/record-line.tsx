'use client'

import { useSyncExternalStore } from 'react'

// The dated top of the record sheet. The 8-hour self-destruct is the product's whole
// promise and it is otherwise stated only on the home page — a deep-linked student
// never learns the sheet erases itself. Dismissal is per device, so it never re-teaches
// the same lesson room after room (onboard: respect dismissals). The store mirrors
// use-anon-token: a raw-string snapshot so useSyncExternalStore never churns, with the
// storage event syncing tabs.
const DISMISS_KEY = 'hitchat:record-line-dismissed'

const dismissListeners = new Set<() => void>()

function emitDismiss() {
  for (const listener of dismissListeners) listener()
}

function subscribe(onChange: () => void) {
  dismissListeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    dismissListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function getSnapshot(): string | null {
  return window.localStorage.getItem(DISMISS_KEY)
}

// Never dismissed on the server, so the line is in the first paint and there is no
// hydration mismatch. A returning visitor who already dismissed it sees it for one
// frame before hydration removes it — the accepted cost of a server-rendered note.
function getServerSnapshot(): string | null {
  return null
}

export function RecordLine() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (dismissed) return null

  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Private-mode quota failure is not worth failing the room over; the line simply
      // stays visible for the session.
    }
    emitDismiss()
  }

  return (
    <div className="flex items-center gap-2 border-b border-hairline px-4 py-1">
      <span className="shrink-0 font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
        {date}
      </span>
      <span aria-hidden className="shrink-0 font-mono text-[12px] leading-4 text-graphite/50">
        ·
      </span>
      <p className="min-w-0 flex-1 font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
        this sheet erases itself 8 hours after each message
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss this note"
        className="touch-target flex size-6 shrink-0 items-center justify-center rounded-input text-graphite transition-colors hover:bg-wash hover:text-ink"
      >
        <CloseGlyph />
      </button>
    </div>
  )
}

// Drawn, not a unicode glyph — the tofu-safe rule every icon in the app follows.
function CloseGlyph() {
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
