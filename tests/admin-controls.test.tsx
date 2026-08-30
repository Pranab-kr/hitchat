import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AdminControls } from '../components/chat/admin-controls'

// Real action failure copy is verified in moderation.test.ts; here we pin the fallback
// that covers the "action returned no message" path, and that the action's own precise
// message still wins when it is present.
const mocks = vi.hoisted(() => ({
  adminDeleteMessage: vi.fn(),
  togglePin: vi.fn(),
}))

vi.mock('@/app/actions/moderation', () => ({
  adminDeleteMessage: mocks.adminDeleteMessage,
  togglePin: mocks.togglePin,
}))

afterEach(cleanup)

describe('AdminControls', () => {
  it('falls back to a precise per-action message when the action returns none', async () => {
    mocks.togglePin.mockResolvedValueOnce({ ok: false })
    render(<AdminControls messageId="m1" isPinned={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'pin' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't pin that. Try again.",
    )
  })

  it('prefers the action-provided message over the fallback', async () => {
    mocks.adminDeleteMessage.mockResolvedValueOnce({
      ok: false,
      message: "Co-admins can't moderate the owner's messages.",
    })
    render(<AdminControls messageId="m1" isPinned={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Co-admins can't moderate the owner's messages.",
    )
  })

  it('clears the error when the next action succeeds', async () => {
    mocks.togglePin.mockResolvedValueOnce({ ok: false })
    mocks.togglePin.mockResolvedValueOnce({ ok: true })
    render(<AdminControls messageId="m1" isPinned={false} />)
    const pin = screen.getByRole('button', { name: 'pin' })

    fireEvent.click(pin)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't pin that. Try again.",
    )

    fireEvent.click(pin)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
