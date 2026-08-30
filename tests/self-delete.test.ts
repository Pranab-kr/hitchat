import { describe, it, expect } from 'vitest'
import { withinSelfDeleteWindow, SELF_DELETE_WINDOW_MS } from '../lib/self-delete'

describe('withinSelfDeleteWindow', () => {
  it('is true for a fresh message', () => {
    const now = Date.now()
    expect(withinSelfDeleteWindow(new Date(now - 1000).toISOString(), now)).toBe(true)
  })

  it('is true exactly at the 5-minute boundary, matching the server', () => {
    // deleteOwnMessage refuses only when ageMs > 5min, so the control must not vanish
    // a moment before the action would still accept the retract.
    const now = Date.now()
    const createdAt = new Date(now - SELF_DELETE_WINDOW_MS).toISOString()
    expect(withinSelfDeleteWindow(createdAt, now)).toBe(true)
  })

  it('is false just past the 5-minute window', () => {
    const now = Date.now()
    const createdAt = new Date(now - SELF_DELETE_WINDOW_MS - 1).toISOString()
    expect(withinSelfDeleteWindow(createdAt, now)).toBe(false)
  })

  it('is false for a message with no created_at (invalid date)', () => {
    expect(withinSelfDeleteWindow('not-a-date', Date.now())).toBe(false)
  })
})
