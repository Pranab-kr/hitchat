'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPostingStatus } from '@/app/actions/me'

// The "surface banned/rate-limited before Send" gate. The banned half is a safe read
// and is polled on mount and every minute, so a ban issued while the user sits in the
// room swaps the composer for the notice without waiting for a rejected Send. The
// rate-limited half cannot be probed (that would consume quota), so it is fed the
// retryAfter the Server Action already returns and counted down from there.
export function useComposerGate(token: string | null) {
  const [bannedMessage, setBannedMessage] = useState<string | null>(null)
  const [rateRetryAt, setRateRetryAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!token) return
    let alive = true

    const check = () => {
      void getPostingStatus({ token }).then((result) => {
        if (alive && result.ok) setBannedMessage(result.data.bannedMessage)
      })
    }

    check()
    const id = setInterval(check, 60_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [token])

  useEffect(() => {
    if (rateRetryAt === null) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= rateRetryAt) setRateRetryAt(null)
    }, 500)
    return () => clearInterval(id)
  }, [rateRetryAt])

  const noteRateLimited = useCallback((retryAfter: number) => {
    // Reset `now` alongside the deadline: without it the first render after a
    // rate-limited send computes remaining against a stale snapshot (a countdown that
    // opened at "Wait 22s" for an 8s window). The tick then keeps it honest.
    setNow(Date.now())
    setRateRetryAt(Date.now() + retryAfter * 1000)
  }, [])

  const remaining = rateRetryAt === null ? 0 : Math.max(0, Math.ceil((rateRetryAt - now) / 1000))

  return { bannedMessage, remaining, noteRateLimited }
}
