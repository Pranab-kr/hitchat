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
      className="group press touch-target inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 hover:bg-wash disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        aria-hidden
        className={`text-graphite transition-[transform,color] duration-500 [transition-timing-function:var(--ease-travel)] group-hover:text-pen ${
          checking ? 'animate-spin' : 'group-hover:rotate-180'
        }`}
      >
        <path
          d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite transition-colors group-hover:text-pen">
        {checking ? 'checking identity…' : locked ? 'identity locked' : 'new identity'}
      </span>
    </button>
  )
}
