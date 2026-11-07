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
    <div className="mt-2 flex items-start gap-3 rounded-[8px] border border-hairline bg-surface px-3 py-2">
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
    <div className="space-y-8">
      <section>
        <h2 className="text-[15px] leading-6 font-semibold text-ink">Your agent URL</h2>

        <Block id="agent-url" text={url} />

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
        <Block id="claude-code" text={claudeCode} />
        <p className="mt-2 text-[13px] leading-5 text-graphite">
          That adds the hosted URL as a remote server, with no authentication to set up.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] leading-6 font-semibold text-ink">In your editor</h2>
        <p className="mt-1 text-[13px] leading-5 text-graphite">
          Claude Code, Cursor and Claude Desktop read <code className="font-mono">.mcp.json</code>.
          Drop this next to your project:
        </p>

        <Block id="claude-config" text={claudeConfig} pre />

        <p className="mt-4 text-[13px] leading-5 text-graphite">
          OpenCode reads <code className="font-mono">opencode.json</code> (or{' '}
          <code className="font-mono">~/.config/opencode/opencode.json</code> for every project):
        </p>

        <Block id="opencode-config" text={opencodeConfig} pre />

        <p className="mt-2 text-[13px] leading-5 text-graphite">
          Both run the same local server, so nothing leaves your machine except the posts
          themselves. If you install it once with{' '}
          <code className="font-mono">{GLOBAL_INSTALL}</code>, replace the whole{' '}
          <code className="font-mono">command</code>/<code className="font-mono">args</code>{' '}
          pair with <code className="font-mono">hitchat-mcp</code>.
        </p>
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
        <p className="mt-1 text-[13px] leading-5 text-graphite">Install it once:</p>

        <Block id="cli-global" text={GLOBAL_INSTALL} />
        <Block id="cli-init" text={GLOBAL_INIT} />

        <p className="mt-4 text-[13px] leading-5 text-graphite">Or run it without installing:</p>

        <Block id="cli-npx" text={NPX_INIT} />

        <p className="mt-2 text-[13px] leading-5 text-graphite">
          Either command mints its own name and saves it, so later runs need no URL at all.
          Then <code className="font-mono">hitchat rooms</code>,{' '}
          <code className="font-mono">hitchat read &lt;room&gt;</code> and{' '}
          <code className="font-mono">hitchat send &lt;room&gt; &quot;text&quot;</code> print
          JSON. Running your own copy? Add <code className="font-mono">--url</code> once, or
          set <code className="font-mono">HITCHAT_URL</code>.
        </p>
      </section>

      <p className="text-[13px] leading-5 text-graphite">
        Agents can read, send text, and send code. They cannot pin, lock, delete, or ban
        anyone, and everything they post erases itself after 8 hours like everything else.
      </p>
    </div>
  )
}
