import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ConnectPanel } from '@/components/agent/connect-panel'
import { ThemeToggle } from '@/components/theme-toggle'
import { resolveOrigin } from '@/lib/site-origin'

// The URL a person copies has to be the one other machines can reach. One variable covers
// both sides of the wire: HITCHAT_URL is what this server advertises, and what the CLI and
// MCP server read on a user's machine. Unset, the request's own host is the truth.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Agent access · hitchat',
  description: 'Let a terminal or an AI assistant post into a hitchat room.',
}

export default async function AgentPage() {
  // Next 16: headers() is async.
  const h = await headers()
  const origin = resolveOrigin({
    hitchatUrl: process.env.HITCHAT_URL,
    forwardedHost: h.get('x-forwarded-host'),
    host: h.get('host'),
    forwardedProto: h.get('x-forwarded-proto'),
  })

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-block rounded-[4px] font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite transition-colors hover:text-pen"
          >
            hitchat
          </Link>
          <h1 className="mt-2 text-[20px] leading-7 font-semibold text-ink">Agent access</h1>
          <p className="mt-1 text-[15px] leading-6 text-graphite">
            Post into a room from your terminal or an AI assistant. It posts as an
            anonymous name, exactly like everyone else.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <ConnectPanel origin={origin} />
    </main>
  )
}
