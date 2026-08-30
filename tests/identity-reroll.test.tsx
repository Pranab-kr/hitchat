import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react'
import { IdentityReroll } from '../components/room/identity-reroll'
import { getPostingStatus } from '@/app/actions/me'
import { useAnonToken } from '@/lib/use-anon-token'

vi.mock('@/app/actions/me', () => ({
  getPostingStatus: vi.fn(),
}))

vi.mock('@/lib/use-anon-token', () => ({
  useAnonToken: vi.fn(),
}))

const status = vi.mocked(getPostingStatus)
const anon = vi.mocked(useAnonToken)

beforeEach(() => {
  status.mockResolvedValue({ ok: true, data: { bannedMessage: null } })
  anon.mockReturnValue({ token: 'token', reroll: vi.fn() })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('IdentityReroll', () => {
  it('checks the current identity before rotating it', async () => {
    const reroll = vi.fn()
    anon.mockReturnValue({ token: 'token', reroll })
    render(<IdentityReroll />)

    fireEvent.click(screen.getByRole('button', { name: /new identity/i }))

    await waitFor(() => expect(reroll).toHaveBeenCalled())
    expect(status).toHaveBeenCalledWith({ token: 'token' })
  })

  it('keeps the identity locked when the current identity is banned', async () => {
    status.mockResolvedValue({ ok: true, data: { bannedMessage: "You can't post here until 2:00 PM." } })
    const reroll = vi.fn()
    anon.mockReturnValue({ token: 'token', reroll })
    render(<IdentityReroll />)

    fireEvent.click(screen.getByRole('button', { name: /new identity/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /identity locked/i })).toBeDisabled())
    expect(reroll).not.toHaveBeenCalled()
  })
})
