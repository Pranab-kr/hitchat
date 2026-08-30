import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { CopyButton } from '../components/chat/copy-button'

// jsdom ships no Clipboard API; installing one makes both paths testable. Rejecting
// here is what the browser does in an insecure context or on a denied permission.
const writeText = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('CopyButton', () => {
  it('confirms a successful copy', async () => {
    writeText.mockResolvedValue(undefined)
    render(<CopyButton text="hello" />)

    fireEvent.click(screen.getByRole('button', { name: 'copy' }))
    await act(async () => {})

    expect(writeText).toHaveBeenCalledWith('hello')
    expect(screen.getByRole('button', { name: /copied/ })).toBeInTheDocument()
  })

  it('reports a refused copy instead of staying silent', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<CopyButton text="hello" />)

    fireEvent.click(screen.getByRole('button', { name: 'copy' }))
    await act(async () => {})

    expect(screen.getByRole('button', { name: "couldn't copy" })).toBeInTheDocument()
  })

  it('reverts to the idle label after the confirm either way', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<CopyButton text="hello" />)

    fireEvent.click(screen.getByRole('button', { name: 'copy' }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: "couldn't copy" })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByRole('button', { name: 'copy' })).toBeInTheDocument()
  })
})
