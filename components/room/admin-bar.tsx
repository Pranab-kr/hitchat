'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleLock, purgeRoom } from '@/app/actions/moderation'

export function AdminBar({ groupId, locked }: { groupId: string; locked: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  function lock() {
    startTransition(async () => {
      const result = await toggleLock(groupId, !locked)
      if (!result.ok) {
        setNotice(result.message)
        return
      }
      setNotice(null)
      // `locked` is a server prop. Groups are not in the Realtime publication — only
      // messages are — so nothing pushes this change; the page has to re-read it.
      router.refresh()
    })
  }

  function purge() {
    startTransition(async () => {
      const result = await purgeRoom(groupId)
      setConfirmPurge(false)
      if (!result.ok) {
        setNotice(result.message)
        return
      }
      // Soft deletes broadcast as UPDATE, so the stream empties itself.
      setNotice(
        result.data.count === 1
          ? 'Cleared 1 message.'
          : `Cleared ${result.data.count.toLocaleString('en-US')} messages.`,
      )
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-wash px-4 py-2">
      {/* marigold text on its own 12% wash measures 1.57:1 on the light paper. The
          color stays as the wash and border (UI surfaces, 3.0 floor); the text is ink. */}
      <span className="rounded-[4px] border-l-2 border-l-marigold bg-marigold/12 px-1.5 py-0.5 font-mono text-[11px] tracking-[0.08em] text-ink">
        SUDO
      </span>

      <button
        type="button"
        disabled={pending}
        onClick={lock}
        className="rounded-input border border-hairline px-2 py-1 font-mono text-[12px] text-graphite transition-colors hover:border-pen hover:text-pen disabled:opacity-40"
      >
        {locked ? 'unlock room' : 'lock room'}
      </button>

      {confirmPurge ? (
        <span className="flex items-center gap-2 font-mono text-[12px] text-ink">
          Clear every message here?
          <button
            type="button"
            disabled={pending}
            onClick={purge}
            className="rounded-input px-2 py-1 text-rule transition-colors hover:bg-rule/10 disabled:opacity-40"
          >
            clear
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmPurge(false)}
            className="rounded-input px-2 py-1 text-graphite transition-colors hover:text-ink disabled:opacity-40"
          >
            keep
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setNotice(null)
            setConfirmPurge(true)
          }}
          className="rounded-input border border-hairline px-2 py-1 font-mono text-[12px] text-graphite transition-colors hover:border-rule hover:text-rule disabled:opacity-40"
        >
          clear room
        </button>
      )}

      {locked && (
        <span className="font-mono text-[12px] text-graphite">
          Students can&apos;t post right now.
        </span>
      )}

      {notice && (
        <span className="font-mono text-[12px] text-graphite" role="status">
          {notice}
        </span>
      )}
    </div>
  )
}
