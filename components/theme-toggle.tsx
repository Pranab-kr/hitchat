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
      className="press touch-target flex size-8 items-center justify-center rounded-full text-graphite hover:bg-wash hover:text-ink"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {/* One drawn disc whose lit half turns over: the same strokes in both themes, so
          the switch reads as a turn rather than an icon swap. */}
      <svg
        viewBox="0 0 20 20"
        width="18"
        height="18"
        aria-hidden
        className="transition-transform duration-500 [transition-timing-function:var(--ease-travel)]"
        style={{ transform: isDark ? 'rotate(180deg)' : 'rotate(0deg)' }}
      >
        <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
      </svg>
    </button>
  )
}
