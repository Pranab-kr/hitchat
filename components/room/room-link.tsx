'use client'

import { useState } from 'react'
import Link from 'next/link'

// A dynamic room cannot use a route-level loading.tsx without streaming a missing
// room as a soft 404 (HTTP 200). Keep the real 404 contract and acknowledge the click
// in the picker immediately while Next fetches the room in the background instead.
export function RoomLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [opening, setOpening] = useState(false)

  return (
    <Link
      href={href}
      prefetch
      onClick={() => setOpening(true)}
      aria-busy={opening}
      className="rounded-input border border-hairline px-3 py-2 font-mono text-[13px] leading-5 text-ink transition-colors hover:border-pen hover:text-pen"
    >
      {opening ? 'Opening room…' : children}
    </Link>
  )
}
