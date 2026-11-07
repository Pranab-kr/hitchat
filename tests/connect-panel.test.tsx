import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ConnectPanel } from '../components/agent/connect-panel'

// The panel is the only place a person can see, copy, or replace the identity an agent
// will post under. These cases pin the three things it can get wrong: the URL it builds,
// the warning it has to say out loud, and the boundary between a separate identity and
// the name the browser is already posting under.

const KEY = 'hitchat:token'
const TOKEN = '123e4567-e89b-42d3-a456-426614174000'
const ORIGIN = 'https://chat.example'

const agentUrl = () => document.getElementById('agent-url')?.textContent ?? ''

beforeEach(() => {
  localStorage.setItem(KEY, TOKEN)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('ConnectPanel', () => {
  it('renders the agent URL built from the current browser identity', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    expect(agentUrl()).toBe(`${ORIGIN}/api/mcp/${TOKEN}`)
  })

  it('says out loud that the link is the identity', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    expect(
      screen.getByText(/anyone with this link can post as this name/i),
    ).toBeInTheDocument()
  })

  it('issues a fresh UUID for a separate identity and leaves the stored one alone', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    fireEvent.click(screen.getByRole('button', { name: /new identity/i }))

    const url = agentUrl()
    const issued = url.slice(`${ORIGIN}/api/mcp/`.length)

    expect(issued).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(issued).not.toBe(TOKEN)
    expect(localStorage.getItem(KEY)).toBe(TOKEN)
  })

  it('shows the global install and the command that follows it', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    expect(document.getElementById('cli-global')?.textContent).toBe(
      'npm i -g @pranabkr/hitchat-agent',
    )
    expect(document.getElementById('cli-init')?.textContent).toBe('hitchat init --new')
  })

  it('shows the no-install command without a URL, because init already defaults to the site', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    const npx = document.getElementById('cli-npx')?.textContent ?? ''
    expect(npx).toBe('npx -y -p @pranabkr/hitchat-agent hitchat init --new')
    expect(npx).not.toContain('--url')
    // `-p` plus the bin name: a package with more than one bin cannot be run by a bare
    // `npx <package>`, which is what the first draft of this page said.
    expect(npx).toContain('-p @pranabkr/hitchat-agent hitchat')
  })

  it('gives editor harnesses a stdio config with the origin and the token filled in', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    const claude = JSON.parse(document.getElementById('claude-config')?.textContent ?? '{}')
    expect(claude).toEqual({
      mcpServers: {
        hitchat: {
          command: 'npx',
          args: ['-y', '-p', '@pranabkr/hitchat-agent', 'hitchat-mcp'],
          env: { HITCHAT_URL: ORIGIN, HITCHAT_TOKEN: TOKEN },
        },
      },
    })
  })

  it('gives OpenCode its own shape, under mcp.servers with an environment block', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    const opencode = JSON.parse(document.getElementById('opencode-config')?.textContent ?? '{}')
    expect(opencode.$schema).toBe('https://opencode.ai/config.json')
    expect(opencode.mcp.servers.hitchat).toEqual({
      type: 'local',
      command: ['npx', '-y', '-p', '@pranabkr/hitchat-agent', 'hitchat-mcp'],
      environment: { HITCHAT_URL: ORIGIN, HITCHAT_TOKEN: TOKEN },
    })
  })

  it('tells the reader how to drop npx after a global install', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    expect(
      screen.getAllByText('npm i -g @pranabkr/hitchat-agent').length,
    ).toBeGreaterThan(0)
  })

  it('carries the command that installs the repo skill into an agent', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    // Verified against the real CLI: `npx skills add Pranab-kr/hitchat` finds
    // skill/hitchat/SKILL.md and installs it into the project's agent directory.
    expect(document.getElementById('skill-install')?.textContent).toBe(
      'npx skills add Pranab-kr/hitchat',
    )
  })

  it('rewrites the editor configs when a separate identity is issued', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    fireEvent.click(screen.getByRole('button', { name: /new identity/i }))

    const claude = JSON.parse(document.getElementById('claude-config')?.textContent ?? '{}')
    const issued = claude.mcpServers.hitchat.env.HITCHAT_TOKEN

    expect(issued).not.toBe(TOKEN)
    expect(agentUrl()).toContain(issued)
  })
})
