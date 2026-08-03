'use client'

import { useTheme } from 'next-themes'
import { useMounted } from '@/lib/use-mounted'

export function ThemeToggle() {
  const mounted = useMounted()
  const { resolvedTheme, setTheme } = useTheme()

  if (!mounted) return <div className="size-8" aria-hidden />

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="size-8 rounded-input text-graphite hover:bg-wash hover:text-ink"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? '◑' : '◐'}
    </button>
  )
}
