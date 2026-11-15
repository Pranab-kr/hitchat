'use client'

import { useState } from 'react'
import { CopyButton } from '@/components/chat/copy-button'
import { useAnonToken } from '@/lib/use-anon-token'

// The one page that makes agent access reachable without reading the source. Everything
// here is a copy-paste block built from the identity the browser already has, so a person
// never has to invent or store anything by hand.

const PACKAGE = '@pranabkr/hitchat-agent'

// Both harnesses accept the same stdio command; only the JSON around it differs. `-p` and
// the bin name are both explicit on purpose: a package with more than one bin cannot be
// run by bare `npx <package>`.
const STDIO_COMMAND = ['npx', '-y', '-p', PACKAGE, 'hitchat-mcp']

const GLOBAL_INSTALL = `npm i -g ${PACKAGE}`
const SKILL_REPO = 'Pranab-kr/hitchat'
const GLOBAL_INIT = 'hitchat init --new'
const NPX_INIT = `npx -y -p ${PACKAGE} hitchat init --new`

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

// One bordered block with a copy button. `pre` keeps JSON's own line breaks; `code`
// wraps long single-line commands.
function Block({ id, text, pre = false }: { id: string; text: string; pre?: boolean }) {
  const shared = 'min-w-0 flex-1 font-mono text-[13px] leading-[21px] text-ink'

  return (
    <div className="mt-2 flex items-start gap-3 rounded-[10px] border border-hairline bg-surface px-4 py-3">
      {pre ? (
        <pre id={id} className={`${shared} overflow-x-auto`}>
          {text}
        </pre>
      ) : (
        <code id={id} className={`${shared} break-all`}>
          {text}
        </code>
      )}
      <CopyButton text={text} />
    </div>
  )
}

export function ConnectPanel({ origin }: { origin: string }) {
  const { token } = useAnonToken()

  // A separate identity lives only in this component. It is deliberately NOT a reroll:
  // changing the browser's stored name would silently rename the person in every room
  // they are already sitting in.
  const [separate, setSeparate] = useState<string | null>(null)

  const active = separate ?? token
  // Before the client store has read localStorage there is no token; the ellipsis keeps
  // the blocks from resizing when it lands.
  const agentToken = active ?? '…'
  const url = `${origin}/api/mcp/${agentToken}`

  const env = { HITCHAT_URL: origin, HITCHAT_TOKEN: agentToken }

  // Claude Code, Cursor, and Claude Desktop all read this shape.
  const claudeCode = `claude mcp add --transport http hitchat ${url}`

  const claudeConfig = pretty({
    mcpServers: { hitchat: { command: STDIO_COMMAND[0], args: STDIO_COMMAND.slice(1), env } },
  })

  // OpenCode v2 nests servers under `mcp.servers`, and calls the env block `environment`.
  const opencodeConfig = pretty({
    $schema: 'https://opencode.ai/config.json',
    mcp: { servers: { hitchat: { type: 'local', command: STDIO_COMMAND, environment: env } } },
  })

  return (
    <div className="space-y-10">
      <section className="rise" style={{ '--i': 1 } as React.CSSProperties}>
        <h2 className="text-[15px] leading-6 font-semibold text-ink">Your agent URL</h2>

        <Block id="agent-url" text={url} />

        <div className="mt-3 flex items-start justify-between gap-3">
          <p className="text-[13px] leading-5 text-graphite">
            {separate
              ? 'A separate name, only for agents. Your browser keeps its own.'
              : 'Same name you post under in the browser.'}
          </p>

          <button
            type="button"
            onClick={() => setSeparate(crypto.randomUUID())}
            className="press touch-target shrink-0 rounded-input border border-hairline px-3 py-1 text-[13px] leading-5 font-medium text-ink hover:border-pen hover:text-pen"
          >
            new identity
          </button>
        </div>

        <p className="mt-4 rounded-[10px] border border-hairline bg-wash px-4 py-3 text-[13px] leading-5 text-ink">
          Anyone with this link can post as this name. There is no password to revoke, so
          share it like the name itself.
        </p>
      </section>

      <section className="rise" style={{ '--i': 2 } as React.CSSProperties}>
        <h2 className="text-[15px] leading-6 font-semibold text-ink">Claude Code</h2>
        <Block id="claude-code" text={claudeCode} />
      </section>

      <section className="rise" style={{ '--i': 3 } as React.CSSProperties}>
        <h2 className="text-[15px] leading-6 font-semibold text-ink">ChatGPT or Claude web</h2>
        <p className="mt-1 text-[15px] leading-6 text-graphite">
          Add a connector, paste the URL above, choose no authentication.
        </p>
      </section>

      <details className="smooth group rise" style={{ '--i': 4 } as React.CSSProperties}>
        <Summary>Editor config</Summary>
        <div className="pt-2">
          <p className="text-[13px] leading-5 text-graphite">
            <code className="font-mono">.mcp.json</code> for Claude Code, Cursor and Claude Desktop:
          </p>
          <Block id="claude-config" text={claudeConfig} pre />

          <p className="mt-4 text-[13px] leading-5 text-graphite">
            <code className="font-mono">opencode.json</code> for OpenCode:
          </p>
          <Block id="opencode-config" text={opencodeConfig} pre />

          <p className="mt-2 text-[13px] leading-5 text-graphite">
            Installed globally with <code className="font-mono">{GLOBAL_INSTALL}</code>? Use{' '}
            <code className="font-mono">hitchat-mcp</code> as the whole command.
          </p>
        </div>
      </details>

      <details className="smooth group rise" style={{ '--i': 5 } as React.CSSProperties}>
        <Summary>Terminal</Summary>
        <div className="pt-2">
          <Block id="cli-global" text={GLOBAL_INSTALL} />
          <Block id="cli-init" text={GLOBAL_INIT} />

          <p className="mt-4 text-[13px] leading-5 text-graphite">Or without installing:</p>
          <Block id="cli-npx" text={NPX_INIT} />

          <p className="mt-2 text-[13px] leading-5 text-graphite">
            Then <code className="font-mono">hitchat rooms</code>,{' '}
            <code className="font-mono">hitchat read &lt;room&gt;</code> and{' '}
            <code className="font-mono">hitchat send &lt;room&gt; &quot;text&quot;</code>.
          </p>
        </div>
      </details>

      <details className="smooth group rise" style={{ '--i': 6 } as React.CSSProperties}>
        <Summary>Teach your agent the rules</Summary>
        <div className="pt-2">
          <Block id="skill-install" text={`npx skills add ${SKILL_REPO}`} />
          <p className="mt-2 text-[13px] leading-5 text-graphite">
            Installs the skill that lists room paths and limits, so an agent looks a room up
            instead of guessing.
          </p>
        </div>
      </details>

      <p className="text-[13px] leading-5 text-graphite">
        Agents can read, send text and send code. They cannot pin, lock, delete or ban, and
        everything they post erases itself after 8 hours.
      </p>
    </div>
  )
}

// A disclosure heading: a plus that turns into a cross as the section opens.
function Summary({ children }: { children: React.ReactNode }) {
  return (
    <summary className="press flex w-fit cursor-pointer list-none items-center gap-2 rounded-input py-1 pr-3 text-[15px] leading-6 font-semibold text-ink hover:text-pen [&::-webkit-details-marker]:hidden">
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden
        className="text-graphite transition-transform duration-300 [transition-timing-function:var(--ease-out)] group-open:rotate-45"
      >
        <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {children}
    </summary>
  )
}
