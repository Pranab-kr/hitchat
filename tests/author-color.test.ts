import { describe, it, expect } from 'vitest'
import { AUTHOR_COLORS, authorColorVar, authorIndex } from '../lib/author-color'

describe('authorIndex', () => {
  it('maps every stored light hex to a distinct glyph slot 0..7', () => {
    const indexes = AUTHOR_COLORS.map((hex) => authorIndex(hex))
    expect(new Set(indexes).size).toBe(AUTHOR_COLORS.length)
    for (const i of indexes) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(8)
    }
  })

  it('is case- and whitespace-insensitive, like authorColorVar', () => {
    expect(authorIndex(`  ${AUTHOR_COLORS[3].toUpperCase()}  `)).toBe(3)
    expect(authorColorVar(AUTHOR_COLORS[3])).toBe('var(--author-4)')
  })

  it('falls back to slot 0 for an unknown value', () => {
    expect(authorIndex('#123456')).toBe(0)
    expect(authorIndex('nonsense')).toBe(0)
  })
})
