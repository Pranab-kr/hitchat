'use client'

import { useState, useTransition } from 'react'
import { adminDeleteMessage, togglePin } from '@/app/actions/moderation'

// Rendered only for a signed-in admin. This is presentation, not authorization — every
// action re-verifies its own session server-side, so hiding these buttons is a
// convenience and never the thing that stops a student from moderating.
export function AdminControls({
  messageId,
  isPinned,
  onBan,
}: {
  messageId: string
  isPinned: boolean
  onBan?: (messageId: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // The plan discarded every result with `void`, so a failed delete or ban looked
  // identical to a successful one. Realtime paints the success; this reports failure.
  // Every real failure already carries a precise message from the action ("Couldn't
  // delete that. Try again."); the per-action fallback keeps even the impossible
  // no-message path from reading like a shrug.
  function run(action: () => Promise<{ ok: boolean; message?: string }>, fallback: string) {
    startTransition(async () => {
      const result = await action()
      setError(result.ok ? null : (result.message ?? fallback))
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => togglePin(messageId, !isPinned), "Couldn't pin that. Try again.")}
        className="touch-target rounded-[4px] px-1.5 py-0.5 font-mono text-[12px] text-graphite transition-opacity hover:bg-wash hover:text-marigold disabled:opacity-40 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
      >
        {isPinned ? 'unpin' : 'pin'}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => adminDeleteMessage(messageId), "Couldn't delete that. Try again.")}
        className="touch-target rounded-[4px] px-1.5 py-0.5 font-mono text-[12px] text-graphite transition-opacity hover:bg-wash hover:text-rule disabled:opacity-40 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
      >
        delete
      </button>

      <button
        type="button"
        disabled={pending}
        // Confirmation is raised by the room, not by window.confirm: a native dialog is
        // unstyleable and Task 8 established that this app reports failures inline.
        onClick={() => onBan?.(messageId)}
        className="touch-target rounded-[4px] px-1.5 py-0.5 font-mono text-[12px] text-graphite transition-opacity hover:bg-wash hover:text-rule disabled:opacity-40 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
      >
        ban
      </button>

      {error && (
        <span className="font-mono text-[12px] text-rule" role="alert">
          {error}
        </span>
      )}
    </>
  )
}
