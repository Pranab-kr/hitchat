import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RecordLine } from '../components/room/record-line'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('RecordLine', () => {
  it('renders the dated self-destruct note and a dismiss control', () => {
    render(<RecordLine />)

    expect(
      screen.getByText('this sheet erases itself 8 hours after each message'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss this note' })).toBeInTheDocument()
  })

  it('hides the line when dismissed and keeps it hidden on re-render', () => {
    const { rerender } = render(<RecordLine />)
    expect(screen.getByText(/erases itself/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this note' }))
    expect(screen.queryByText(/erases itself/)).not.toBeInTheDocument()

    rerender(<RecordLine />)
    expect(screen.queryByText(/erases itself/)).not.toBeInTheDocument()
  })

  it('records the dismissal in localStorage so a later visit stays quiet', () => {
    render(<RecordLine />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this note' }))

    expect(localStorage.getItem('hitchat:record-line-dismissed')).toBe('1')
  })

  it('renders nothing when the device has already dismissed it', () => {
    localStorage.setItem('hitchat:record-line-dismissed', '1')
    const { container } = render(<RecordLine />)

    expect(container).toBeEmptyDOMElement()
  })
})
