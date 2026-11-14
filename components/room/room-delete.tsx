'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { canDeleteRoom, deleteRoom } from '@/app/actions/rooms'
import { useAnonToken } from '@/lib/use-anon-token'

// The room-level counterpart to AdminBar: delete follows creator ownership, so the
// control is offered only to the owner and to whoever made the room. `canDelete` is the
// server's verdict for the signed-in viewer; an anonymous creator's token lives in
// localStorage and cannot be seen at render time, so those rooms ask once after mount.
export function RoomDelete({
  groupId,
  label,
  canDelete,
  creatorIsAnon,
}: {
  groupId: string
  label: string
  canDelete: boolean
  creatorIsAnon: boolean
}) {
  const router = useRouter()
  const { token } = useAnonToken()
  const [allowed, setAllowed] = useState(canDelete)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (canDelete || !creatorIsAnon || !token) return

    let alive = true
    canDeleteRoom({ groupId, token }).then((result) => {
      if (alive && result.ok && result.data.canDelete) setAllowed(true)
    })

    return () => {
      alive = false
    }
  }, [canDelete, creatorIsAnon, token, groupId])

  if (!allowed) return null

  function remove() {
    startTransition(async () => {
      const result = await deleteRoom({ groupId, token: token ?? undefined })
      if (!result.ok) {
        setConfirming(false)
        setNotice(result.message)
        return
      }
      // The room is gone, so this page is gone with it. Back to the picker, which is
      // force-dynamic and therefore re-reads the tree on arrival.
      router.push('/')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-wash px-4 py-2 font-mono text-[12px] leading-4">
      {confirming ? (
        <>
          <span className="text-ink">Delete room {label} and every message in it?</span>
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="rounded-input px-2 py-1 text-rule transition-colors hover:bg-rule/10 disabled:opacity-40"
          >
            {pending ? 'deleting…' : 'delete'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className="rounded-input px-2 py-1 text-graphite transition-colors hover:text-ink disabled:opacity-40"
          >
            keep
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setNotice(null)
            setConfirming(true)
          }}
          className="rounded-input border border-hairline px-2 py-1 text-graphite transition-colors hover:border-rule hover:text-rule"
        >
          delete room
        </button>
      )}

      {notice && (
        <span role="status" className="text-graphite">
          {notice}
        </span>
      )}
    </div>
  )
}
