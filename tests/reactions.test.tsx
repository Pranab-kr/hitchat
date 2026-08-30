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
  it('shows a visible word label beside every glyph', () => {
    render(
      <Reactions messageId="m1" state={empty} error={null} pending={false} onToggle={() => {}} />,
    )

    for (const label of ['works', 'buggy', 'nice', 'looking']) {
      expect(screen.getByRole('button', { name: label })).toHaveTextContent(label)
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

  it('draws every mark as an SVG in currentColor, never an emoji', () => {
    const { container } = render(
      <Reactions messageId="m1" state={empty} error={null} pending={false} onToggle={() => {}} />,
    )

    expect(container.querySelectorAll('button svg[aria-hidden="true"]')).toHaveLength(4)
    expect(container.innerHTML).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
