'use client'

import { useEffect, useState } from 'react'

// Reading Date.now() in a render body is impure — React's lint rule rejects it, and a
// render-time snapshot only refreshes when something else re-renders, so an expiring
// message would linger until the next unrelated update. This ticks instead.
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
