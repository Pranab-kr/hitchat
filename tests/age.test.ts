import { describe, it, expect } from 'vitest'
import { ageOpacity } from '../lib/age'

const HOUR = 60 * 60 * 1000
const now = Date.UTC(2026, 7, 4, 12, 0, 0)
const agoHours = (h: number) => new Date(now - h * HOUR).toISOString()

describe('ageOpacity', () => {
  it('is fully opaque for a fresh message', () => {
    expect(ageOpacity(agoHours(0), now)).toBe(1)
  })

  it('stays fully opaque through the first 6 hours', () => {
    expect(ageOpacity(agoHours(5.9), now)).toBe(1)
  })

  it('steps down at each documented threshold', () => {
    expect(ageOpacity(agoHours(7), now)).toBe(0.85)
    expect(ageOpacity(agoHours(13), now)).toBe(0.7)
    expect(ageOpacity(agoHours(19), now)).toBe(0.55)
  })

  it('never drops below the 0.55 contrast floor', () => {
    expect(ageOpacity(agoHours(23.9), now)).toBe(0.55)
    expect(ageOpacity(agoHours(100), now)).toBe(0.55)
  })

  it('decreases monotonically', () => {
    const values = [0, 7, 13, 19, 23].map((h) => ageOpacity(agoHours(h), now))
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1])
    }
  })

  // A clock skew between server and client, or a message inserted with a slightly
  // future created_at, must not produce an opacity above 1.
  it('clamps a future timestamp to fully opaque', () => {
    expect(ageOpacity(new Date(now + HOUR).toISOString(), now)).toBe(1)
  })
})
