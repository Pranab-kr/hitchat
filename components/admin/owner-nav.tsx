'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// The owner pages' tab row. A client component only because the active tab comes from
// the pathname; the links themselves are plain prefetched links. The admins tab is
// omitted for a co-admin — presentation only, the page and every action re-verify.
export function OwnerNav({ role }: { role?: 'owner' | 'co_admin' }) {
  const pathname = usePathname()

  const tabs = [
    { href: '/sudo', label: 'structure', active: pathname === '/sudo' },
    ...(role !== 'co_admin'
      ? [{ href: '/sudo/admins', label: 'admins', active: pathname.startsWith('/sudo/admins') }]
      : []),
    { href: '/', label: 'rooms', active: false },
  ]

  return (
    <nav aria-label="Owner" className="mb-10 flex gap-1 border-b border-hairline">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          prefetch
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={`relative touch-target px-3 py-3 font-mono text-[12px] leading-4 tracking-[0.02em] transition-colors duration-150 first:-ml-3 ${
            tab.active ? 'text-ink' : 'text-graphite hover:text-ink'
          }`}
        >
          {tab.label}
          <span
            aria-hidden
            className={`absolute inset-x-3 -bottom-px h-[2px] origin-left bg-pen transition-transform duration-300 [transition-timing-function:var(--ease-out)] ${
              tab.active ? 'scale-x-100' : 'scale-x-0'
            }`}
          />
        </Link>
      ))}
    </nav>
  )
}
