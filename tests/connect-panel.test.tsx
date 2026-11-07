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

  it('carries the CLI command for the origin it was given', () => {
    render(<ConnectPanel origin={ORIGIN} />)

    expect(
      screen.getByText(`npx @pranabkr/hitchat-agent init --url ${ORIGIN} --new`),
    ).toBeInTheDocument()
  })
})
