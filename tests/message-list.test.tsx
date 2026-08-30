import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MessageList } from '../components/chat/message-list'

// The stream container calls scrollIntoView on mount; jsdom never implements it.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

vi.mock('motion/react', () => ({
  useReducedMotion: () => false,
}))
vi.mock('@/lib/use-realtime-messages', () => ({
  useRealtimeMessages: () => ({ messages: [], connected: true }),
}))
vi.mock('@/lib/use-reactions', () => ({
  useReactions: () => ({
    reactionsFor: () => undefined,
    errorFor: () => null,
    isPendingFor: () => false,
    toggle: vi.fn(),
  }),
}))
vi.mock('@/lib/use-own-messages', () => ({
  useOwnMessages: () => ({ isOwn: () => false }),
}))
vi.mock('@/lib/use-now', () => ({
  useNow: () => Date.now(),
}))
vi.mock('@/app/actions/moderation', () => ({
  banAuthor: vi.fn(),
}))
vi.mock('@/components/chat/composer', () => ({
  Composer: () => <div data-testid="composer" />,
}))
vi.mock('@/components/chat/message-row', () => ({
  MessageRow: () => <div />,
}))

afterEach(cleanup)

describe('MessageList stream a11y', () => {
  it('marks the stream as a polite log so new messages are announced', () => {
    render(<MessageList groupId="g" locked={false} initial={[]} initialCodeHtml={{}} />)

    const log = screen.getByRole('log')
    expect(log).toHaveAttribute('aria-live', 'polite')
  })
})
