'use client'

import { useState } from 'react'
import { CopyButton } from '@/components/chat/copy-button'
import { useAnonToken } from '@/lib/use-anon-token'

// The one page that makes agent access reachable without reading the source. Everything
// here is a copy-paste block built from the identity the browser already has, so a person
// never has to invent or store anything by hand.

export function ConnectPanel({ origin }: { origin: string }) {
  const { token } = useAnonToken()

  // A separate identity lives only in this component. It is deliberately NOT a reroll:
  // changing the browser's stored name would silently rename the person in every room
  // they are already sitting in.
  const [separate, setSeparate] = useState<string | null>(null)

  const active = separate ?? token
  // Before the client store has read localStorage there is no token; the ellipsis keeps
  // the block from resizing when it lands.
  const url = active ? `${origin}/api/mcp/${active}` : `${origin}/api/mcp/…`

  const claudeCode = `claude mcp add --transport http hitchat ${url}`
  const cli = `npx @pranabkr/hitchat-agent init --url ${origin} --new`

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[15px] leading-6 font-semibold text-ink">Your agent URL</h2>

        <div className="mt-2 flex items-start gap-3 rounded-[8px] border border-hairline bg-surface px-3 py-2">
          <code
            id="agent-url"
            className="min-w-0 flex-1 break-all font-mono text-[13px] leading-[21px] text-ink"
          >
            {url}
          </code>
          <CopyButton text={url} />
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <p className="text-[13px] leading-5 text-graphite">
            {separate
              ? 'A separate name, only for agents. Your browser keeps its own.'
              : 'This is the name you already post under in the browser.'}
          </p>

          <button
            type="button"
            onClick={() => setSeparate(crypto.randomUUID())}
            className="touch-target shrink-0 rounded-[4px] text-right transition-colors"
          >
            <span className="block text-[13px] leading-5 font-medium text-ink">new identity</span>
            <span className="block font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
              for agents only
            </span>
          </button>
        </div>
      </section>

      <section className="rounded-[8px] border border-hairline bg-wash px-4 py-3">
        <p className="text-[13px] leading-5 text-ink">
          Anyone with this link can post as this name. There is no password behind it and
          nothing to revoke, so share it the way you would share the name itself.
        </p>
        <p className="mt-1 text-[13px] leading-5 text-graphite">
          If that is not what you want, press new identity above and pass on the new link
          instead.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] leading-6 font-semibold text-ink">Claude Code</h2>
        <div className="mt-2 flex items-start gap-3 rounded-[8px] border border-hairline bg-surface px-3 py-2">
          <code className="min-w-0 flex-1 break-all font-mono text-[13px] leading-[21px] text-ink">
            {claudeCode}
          </code>
          <CopyButton text={claudeCode} />
        </div>
      </section>

      <section>
        <h2 className="text-[15px] leading-6 font-semibold text-ink">ChatGPT or Claude web</h2>
        <p className="mt-1 text-[15px] leading-6 text-graphite">
          Add a connector, paste the URL from the top of this page, and choose no
          authentication. That is the whole setup.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] leading-6 font-semibold text-ink">Your terminal</h2>
        <div className="mt-2 flex items-start gap-3 rounded-[8px] border border-hairline bg-surface px-3 py-2">
          <code className="min-w-0 flex-1 break-all font-mono text-[13px] leading-[21px] text-ink">
            {cli}
          </code>
          <CopyButton text={cli} />
        </div>
        <p className="mt-2 text-[13px] leading-5 text-graphite">
          That command mints its own name. Once it is set up, <code className="font-mono">hitchat rooms</code>,{' '}
          <code className="font-mono">hitchat read &lt;room&gt;</code> and{' '}
          <code className="font-mono">hitchat send &lt;room&gt; &quot;text&quot;</code> print JSON.
        </p>
      </section>

      <p className="text-[13px] leading-5 text-graphite">
        Agents can read, send text, and send code. They cannot pin, lock, delete, or ban
        anyone, and everything they post erases itself after 8 hours like everything else.
      </p>
    </div>
  )
}
