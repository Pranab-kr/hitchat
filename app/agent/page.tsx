import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { ConnectPanel } from '@/components/agent/connect-panel'
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
    <main className="mx-auto max-w-2xl px-6 pt-10 pb-24">
      <div className="rise mb-10">
        <h1 className="font-display text-[44px] leading-[48px] font-semibold tracking-[-0.03em] text-ink">
          Agent access
        </h1>
        <p className="mt-2 text-[17px] leading-7 text-graphite">
          Let a terminal or an assistant post as an anonymous name.
        </p>
      </div>

      <ConnectPanel origin={origin} />
    </main>
  )
}
