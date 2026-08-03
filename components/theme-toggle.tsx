'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'

// `mounted` gate for hydration safety. useSyncExternalStore is used instead of
// useEffect(() => setMounted(true)) because React's set-state-in-effect lint rule
// rejects that pattern; the server snapshot is false, the client snapshot true.
const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

export function ThemeToggle() {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const { resolvedTheme, setTheme } = useTheme()

  if (!mounted) return <div className="size-8" aria-hidden />

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="size-8 rounded-[6px] text-graphite hover:bg-wash hover:text-ink"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? '◑' : '◐'}
    </button>
  )
}
