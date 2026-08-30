import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Reactions } from '../components/chat/reactions'
import type { ReactionState } from '../app/actions/reactions'

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => false }
})

const empty: ReactionState = { counts: {}, mine: [] }

afterEach(cleanup)

describe('Reactions', () => {
  it('uses emoji marks without visible word labels', () => {
    render(
      <Reactions messageId="m1" state={empty} error={null} pending={false} onToggle={() => {}} />,
    )

    for (const [label, mark] of [
      ['works', '✅'],
      ['buggy', '⚠️'],
      ['nice', '🔥'],
      ['looking', '👀'],
    ]) {
      const button = screen.getByRole('button', { name: label })
      expect(button).toHaveTextContent(mark)
      expect(button).not.toHaveTextContent(label)
    }
  })

  it('appends the count to the label when people have reacted', () => {
    const state: ReactionState = { counts: { works: 4, buggy: 1 }, mine: [] }
    render(
      <Reactions messageId="m1" state={state} error={null} pending={false} onToggle={() => {}} />,
    )

    expect(screen.getByRole('button', { name: 'works, 4' })).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: 'buggy, 1' })).toHaveTextContent('1')
  })

  it('marks the viewer-owned reaction as pressed', () => {
    const state: ReactionState = { counts: { fire: 2 }, mine: ['fire'] }
    render(
      <Reactions messageId="m1" state={state} error={null} pending={false} onToggle={() => {}} />,
    )

    expect(screen.getByRole('button', { name: 'nice, 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('keeps the emoji marks decorative while the button stays accessible', () => {
    const { container } = render(
      <Reactions messageId="m1" state={empty} error={null} pending={false} onToggle={() => {}} />,
    )

    expect(container.querySelectorAll('button span[aria-hidden="true"]')).toHaveLength(4)
    expect(container.querySelectorAll('button[aria-label]')).toHaveLength(4)
  })
})
