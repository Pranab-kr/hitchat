import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PinnedStrip } from '../components/room/pinned-strip'
import type { Message } from '../lib/types'

afterEach(cleanup)

function pinnedMessage(id: string, name: string): Message {
  return {
    id,
    group_id: 'g',
    kind: 'text',
    body: `body ${id}`,
    code_lang: null,
    code_title: null,
    lab_tag: null,
    reply_to_id: null,
    author_name: name,
    author_color: '#257E44',
    admin_id: null,
    is_pinned: true,
    deleted_at: null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000 * 60).toISOString(),
    reaction_bump: '0',
  }
}

describe('PinnedStrip', () => {
  it('renders nothing with no pins', () => {
    const { container } = render(<PinnedStrip pinned={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('gives the toggle and every jump row the touch-target floor', () => {
    const pinned = [pinnedMessage('m-1', 'NixFox042'), pinnedMessage('m-2', 'AeroPanda013')]
    render(<PinnedStrip pinned={pinned} />)

    expect(screen.getByRole('button', { name: /PINNED/ }).className).toContain('touch-target')

    fireEvent.click(screen.getByRole('button', { name: /PINNED/ }))
    for (const name of ['NixFox042', 'AeroPanda013']) {
      expect(screen.getByRole('button', { name: new RegExp(name) }).className).toContain(
        'touch-target',
      )
    }
  })

  it('jumps to the matching message id from a jump row', () => {
    const pinned = [pinnedMessage('m-1', 'NixFox042')]
    const onJumpTo = vi.fn()
    render(<PinnedStrip pinned={pinned} onJumpTo={onJumpTo} />)

    fireEvent.click(screen.getByRole('button', { name: /PINNED/ }))
    fireEvent.click(screen.getByRole('button', { name: /NixFox042/ }))
    expect(onJumpTo).toHaveBeenCalledWith('m-1')
  })

  it('renders a non-color author mark beside each pinned author name', () => {
    const pinned = [pinnedMessage('m-1', 'NixFox042')]
    const { container } = render(<PinnedStrip pinned={pinned} />)

    fireEvent.click(screen.getByRole('button', { name: /PINNED/ }))
    const row = screen.getByRole('button', { name: /NixFox042/ })
    const svgs = row.querySelectorAll('svg[aria-hidden="true"]')
    expect(svgs.length).toBe(1)
    expect(container.querySelectorAll('svg')).not.toHaveLength(0)
  })
})
