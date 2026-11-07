'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'

export function Navbar() {
  const pathname = usePathname()

  // In-room chat (/c/...) has its own two-column lab-sheet frame (design.md § Layout).
  if (pathname.startsWith('/c/')) {
    return null
  }

  const isAgent = pathname === '/agent' || pathname.startsWith('/agent/')
  const isSudo = pathname === '/sudo' || pathname.startsWith('/sudo/')

  return (
    <header className="sticky top-0 z-40 w-full border-b border-hairline bg-paper/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          prefetch
          aria-label="hitchat home"
          className="touch-target inline-flex items-center font-display text-[20px] leading-6 font-semibold tracking-[-0.02em] text-ink transition-colors hover:text-pen"
        >
          hitchat
        </Link>

        <nav aria-label="Main" className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/agent"
            prefetch
            aria-current={isAgent ? 'page' : undefined}
            className={`touch-target inline-flex items-center rounded-input border px-3 py-1.5 text-[13px] leading-5 font-medium transition-colors ${
              isAgent
                ? 'border-pen bg-wash text-pen'
                : 'border-hairline text-ink hover:bg-wash hover:text-pen'
            }`}
          >
            Agent docs
          </Link>

          <Link
            href="/sudo"
            prefetch
            aria-current={isSudo ? 'page' : undefined}
            className={`touch-target inline-flex items-center rounded-input border border-hairline border-l-2 border-l-marigold px-2.5 py-1.5 font-mono text-[11px] leading-5 font-semibold tracking-[0.08em] text-ink transition-colors ${
              isSudo
                ? 'bg-marigold/20 ring-1 ring-marigold/40'
                : 'bg-marigold/10 hover:bg-marigold/20'
            }`}
          >
            SUDO
          </Link>

          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
