'use client'

import { useEffect, useState } from 'react'
import { getPostingStatus } from '@/app/actions/me'
import { useAnonToken } from '@/lib/use-anon-token'

export function IdentityReroll() {
  const { token, reroll } = useAnonToken()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  // A ban is bound to the current anonymous identity. Re-checking here closes the
  // exact gap where a user could click this header control immediately after an admin
  // banned them, before the composer's 60-second status poll noticed.
  useEffect(() => {
    if (!token) return
    let alive = true

    const check = () => {
      void getPostingStatus({ token }).then((result) => {
        if (!alive) return
        setStatusMessage(
          result.ok
            ? result.data.bannedMessage
            : "Couldn't check your posting status. Try again.",
        )
      })
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [token])

  async function handleReroll() {
    if (!token || checking || statusMessage) return
    setChecking(true)
    const result = await getPostingStatus({ token })
    if (result.ok && !result.data.bannedMessage) {
      reroll()
      setStatusMessage(null)
    } else if (result.ok) {
      setStatusMessage('Identity stays locked while you are banned.')
    } else {
      setStatusMessage("Couldn't check your posting status. Try again.")
    }
    setChecking(false)
  }

  const locked = Boolean(statusMessage)

  return (
    <button
      type="button"
      onClick={() => void handleReroll()}
      disabled={checking || locked}
      title={
        locked
          ? statusMessage ?? 'Identity changes are unavailable while banned'
          : 'Generate a new anonymous identity on this device'
      }
      className="group touch-target flex flex-col items-end rounded-[4px] px-1.5 py-0.5 text-right transition-colors hover:bg-wash disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite transition-colors group-hover:text-pen">
        {checking ? 'checking identity…' : locked ? 'identity locked' : 'new identity'}
      </span>
      <span className="font-mono text-[11px] leading-4 text-graphite">
        {locked ? 'while banned' : 'fresh anonymous name'}
      </span>
    </button>
  )
}
