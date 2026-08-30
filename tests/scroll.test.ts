import { describe, it, expect } from 'vitest'
import { isNearBottom, NEAR_BOTTOM_OFFSET } from '../lib/scroll'

function el(scrollHeight: number, scrollTop: number, clientHeight: number) {
  return { scrollHeight, scrollTop, clientHeight } as unknown as HTMLElement
}

describe('isNearBottom', () => {
  it('is true when the gap to the bottom is within the offset', () => {
    // scrollHeight - scrollTop - clientHeight = 0 → at the bottom
    expect(isNearBottom(el(1000, 900, 100))).toBe(true)
    // gap 20 < 120 → near the bottom
    expect(isNearBottom(el(1000, 880, 100))).toBe(true)
  })

  it('is false when the reader is up in history', () => {
    // gap 200 ≥ 120 → reading history
    expect(isNearBottom(el(1000, 700, 100))).toBe(false)
    // gap exactly 120 → the strict < means this is NOT "near" the bottom
    expect(isNearBottom(el(1000, 780, 100))).toBe(false)
    // gap 119 → one pixel inside the offset
    expect(isNearBottom(el(1000, 781, 100))).toBe(true)
  })

  it('is true when the content fits without scrolling', () => {
    expect(isNearBottom(el(500, 0, 500))).toBe(true)
  })

  it('honours a custom offset', () => {
    expect(isNearBottom(el(1000, 800, 100), 200)).toBe(true)
    expect(isNearBottom(el(1000, 600, 100), 200)).toBe(false)
  })

  it('exposes the default offset used by the stream', () => {
    expect(NEAR_BOTTOM_OFFSET).toBeGreaterThan(0)
  })
})
