import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runCli } from '../src/cli'
import { writeConfig } from '../src/config'

// The CLI is a thin shell over the client, so these cases check the three things it can
// get wrong on its own: what it writes to disk, what it prints, and what it exits with.

const BASE = 'http://localhost:3000'
const TOKEN = 'b'.repeat(36)

let dir: string
let file: string

function harness(
  reply: (call: { url: string; init: RequestInit }) => Response | Promise<Response>,
) {
  const out: string[] = []
  const err: string[] = []
  const calls: { url: string; init: RequestInit }[] = []

  const fetchImpl: typeof fetch = async (input, init) => {
    const call = { url: String(input), init: init ?? {} }
    calls.push(call)
    return reply(call)
  }

  return {
    out,
    err,
    calls,
    fetchImpl,
    io: { out: (s: string) => out.push(s), err: (s: string) => err.push(s) },
  }
}

type Harness = ReturnType<typeof harness>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const printed = (h: Harness) => h.out.join('')
const errored = (h: Harness) => h.err.join('')

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'hitchat-cli-'))
  file = path.join(dir, 'config.json')
  process.env.HITCHAT_CONFIG = file
  delete process.env.HITCHAT_URL
  delete process.env.HITCHAT_TOKEN
})

afterEach(() => {
  delete process.env.HITCHAT_CONFIG
  rmSync(dir, { recursive: true, force: true })
})

describe('init', () => {
  it('proves the URL and token, then writes the config and prints {"ok":true}', async () => {
    const h = harness(() => json({ ok: true, data: { rooms: [] } }))

    const code = await runCli(['init', '--url', BASE, '--token', TOKEN], h.io, h.fetchImpl)

    expect(code).toBe(0)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ url: BASE, token: TOKEN })
    expect(printed(h)).toBe('{"ok":true}\n')
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0].url).toBe(`${BASE}/api/agent/rooms`)
  })

  it('mints a 36-character UUID with --new', async () => {
    const h = harness(() => json({ ok: true, data: { rooms: [] } }))

    const code = await runCli(['init', '--url', BASE, '--new'], h.io, h.fetchImpl)

    expect(code).toBe(0)
    const saved = JSON.parse(readFileSync(file, 'utf8')) as { url: string; token: string }
    expect(saved.token).toHaveLength(36)
    expect(saved.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(new Headers(h.calls[0].init.headers).get('authorization')).toBe(`Bearer ${saved.token}`)
  })

  it('exits 2 with a usage message and writes nothing when --url is missing', async () => {
    const h = harness(() => json({ ok: true, data: { rooms: [] } }))

    const code = await runCli(['init', '--new'], h.io, h.fetchImpl)

    expect(code).toBe(2)
    expect(errored(h)).toContain('--url')
    expect(existsSync(file)).toBe(false)
  })

  it('refuses to write a config the server rejected', async () => {
    const h = harness(() => json({ ok: false, code: 'unauthorized', message: 'Bad token.' }, 401))

    const code = await runCli(['init', '--url', BASE, '--token', TOKEN], h.io, h.fetchImpl)

    expect(code).toBe(1)
    expect(errored(h)).toContain('Bad token.')
    expect(existsSync(file)).toBe(false)
  })
})

describe('rooms / read', () => {
  const room = { path: 'cse/3/2/A', dept: 'cse', year: 3, batch: 2, group: 'A', locked: false }

  it('prints the room list as JSON', async () => {
    writeConfig({ url: BASE, token: TOKEN })
    const h = harness(() => json({ ok: true, data: { rooms: [room] } }))

    const code = await runCli(['rooms'], h.io, h.fetchImpl)

    expect(code).toBe(0)
    expect(JSON.parse(printed(h))).toEqual([room])
    expect(printed(h)).toContain('cse/3/2/A')
  })

  it('prints messages and passes --limit through', async () => {
    writeConfig({ url: BASE, token: TOKEN })
    const h = harness(() => json({ ok: true, data: { room: 'cse/3/2/A', messages: [] } }))

    const code = await runCli(['read', 'cse/3/2/A', '--limit', '5'], h.io, h.fetchImpl)

    expect(code).toBe(0)
    expect(JSON.parse(printed(h))).toEqual([])
    expect(new URL(h.calls[0].url).searchParams.get('limit')).toBe('5')
  })

  it('exits 2 when there is no config to read', async () => {
    const h = harness(() => json({ ok: true, data: { rooms: [] } }))

    const code = await runCli(['rooms'], h.io, h.fetchImpl)

    expect(code).toBe(2)
    expect(errored(h)).toContain('init')
    expect(h.calls).toHaveLength(0)
  })
})

describe('send', () => {
  const sent = {
    id: 'm-1',
    room: 'cse/3/2/A',
    url: 'http://localhost:3000/c/cse/3/2/a',
    expires_at: '2026-11-07T22:00:00.000Z',
  }

  it('posts text and prints the sent message', async () => {
    writeConfig({ url: BASE, token: TOKEN })
    const h = harness(() => json({ ok: true, data: sent }))

    const code = await runCli(['send', 'cse/3/2/A', 'hello from the CLI'], h.io, h.fetchImpl)

    expect(code).toBe(0)
    expect(JSON.parse(printed(h))).toEqual(sent)
    expect(new URL(h.calls[0].url).pathname).toBe('/api/agent/messages')
    expect(JSON.parse(String(h.calls[0].init.body))).toEqual({
      room: 'cse/3/2/A',
      text: 'hello from the CLI',
    })
  })

  it('reads a --code-file and posts it as code with --lang', async () => {
    writeConfig({ url: BASE, token: TOKEN })
    const snippet = path.join(dir, 'snippet.py')
    writeFileSync(snippet, 'print(1)\n')
    const h = harness(() => json({ ok: true, data: sent }))

    const code = await runCli(
      ['send', 'cse/3/2/A', '--code-file', snippet, '--lang', 'python', '--title', 'Demo', '--lab', 'Lab 3'],
      h.io,
      h.fetchImpl,
    )

    expect(code).toBe(0)
    expect(new URL(h.calls[0].url).pathname).toBe('/api/agent/code')
    expect(JSON.parse(String(h.calls[0].init.body))).toEqual({
      room: 'cse/3/2/A',
      code: 'print(1)\n',
      lang: 'python',
      title: 'Demo',
      lab_tag: 'Lab 3',
    })
  })

  it('exits 2 when --code-file arrives without --lang', async () => {
    writeConfig({ url: BASE, token: TOKEN })
    const snippet = path.join(dir, 'snippet.py')
    writeFileSync(snippet, 'print(1)\n')
    const h = harness(() => json({ ok: true, data: sent }))

    const code = await runCli(['send', 'cse/3/2/A', '--code-file', snippet], h.io, h.fetchImpl)

    expect(code).toBe(2)
    expect(errored(h)).toContain('--lang')
    expect(h.calls).toHaveLength(0)
  })

  it('prints the server message to stderr and exits 1 on a 429', async () => {
    writeConfig({ url: BASE, token: TOKEN })
    const h = harness(() =>
      json(
        { ok: false, code: 'rate_limited', message: 'You are posting too fast.', retryAfter: 7 },
        429,
      ),
    )

    const code = await runCli(['send', 'cse/3/2/A', 'too much'], h.io, h.fetchImpl)

    expect(code).toBe(1)
    expect(errored(h)).toContain('You are posting too fast.')
    expect(printed(h)).toBe('')
  })
})
