'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'

export function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      const isScrolled = window.scrollY > 16
      setScrolled((prev) => (prev !== isScrolled ? isScrolled : prev))
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // In-room chat (/c/...) has its own two-column lab-sheet frame (design.md § Layout).
  if (pathname.startsWith('/c/')) {
    return null
  }

  const isAgent = pathname === '/agent' || pathname.startsWith('/agent/')
  const isSudo = pathname === '/sudo' || pathname.startsWith('/sudo/')

  return (
    <header className="sticky top-0 sm:top-2 z-40 w-full px-4 sm:px-6 pointer-events-none transition-all duration-300">
      <div
        className={`mx-auto flex items-center justify-between rounded-full pointer-events-auto transition-all duration-300 ease-out motion-reduce:transition-none ${
          scrolled
            ? 'max-w-[620px] border border-hairline bg-paper/85 dark:bg-paper/85 backdrop-blur-md shadow-xs px-3.5 py-1.5 sm:px-4 sm:py-2 translate-y-2 scale-[0.98]'
            : 'max-w-2xl border border-transparent bg-transparent shadow-none px-4 py-3 sm:px-6 sm:py-4 translate-y-0 scale-100'
        }`}
      >
        <Link
          href="/"
          prefetch
          aria-label="hitchat home"
          className="group touch-target inline-flex size-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-wash"
        >
          <HitchatLogo />
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/agent"
            prefetch
            aria-current={isAgent ? 'page' : undefined}
            className="group relative touch-target inline-flex items-center rounded-full px-3 py-1 text-[13px] leading-5 font-medium transition-colors"
          >
            <span
              className={`transition-colors duration-150 ${
                isAgent ? 'text-ink font-semibold' : 'text-graphite group-hover:text-ink'
              }`}
            >
              Agent docs
            </span>
            <span
              className={`absolute bottom-0 left-3 right-3 h-[1.5px] rounded-full transition-all duration-200 ${
                isAgent
                  ? 'bg-pen scale-x-100 opacity-100'
                  : 'bg-pen scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100'
              } origin-center`}
            />
          </Link>

          <Link
            href="/sudo"
            prefetch
            aria-current={isSudo ? 'page' : undefined}
            className="group relative touch-target inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[12px] leading-5 tracking-[0.06em] font-medium transition-colors"
          >
            <span
              className={`size-1.5 rounded-full transition-transform duration-150 ${
                isSudo
                  ? 'bg-marigold scale-110'
                  : 'bg-marigold/70 group-hover:scale-125 group-hover:bg-marigold'
              }`}
            />
            <span
              className={`transition-colors duration-150 ${
                isSudo ? 'text-ink font-semibold' : 'text-graphite group-hover:text-ink'
              }`}
            >
              SUDO
            </span>
            <span
              className={`absolute bottom-0 left-3 right-3 h-[1.5px] rounded-full transition-all duration-200 ${
                isSudo
                  ? 'bg-marigold scale-x-100 opacity-100'
                  : 'bg-marigold scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100'
              } origin-center`}
            />
          </Link>

          <div className="ml-1 flex items-center border-l border-hairline pl-1 sm:pl-2">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  )
}

// Lab record file meets chat: lab paper bubble with hitchat's signature 2px vertical red rule
function HitchatLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      className="shrink-0 transition-transform duration-200 group-hover:scale-110"
    >
      <path
        d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9l-4 3.5V6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 5.5v8"
        stroke="var(--rule)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11.5 8h5M11.5 11.5h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
    </svg>
  )
}
