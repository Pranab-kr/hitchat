// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.IDENTITY_PEPPER = 'test-pepper-value-at-least-32-chars-long'
})

const { hashToken, deriveHandle, AUTHOR_COLORS } = await import('../lib/identity')

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
  })

  it('differs for different tokens', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })

  it('does not contain the raw token', () => {
    expect(hashToken('abc')).not.toContain('abc')
  })

  it('produces a 64-char hex sha256', () => {
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/)
  })

  // The pepper stops a client knowing its raw token from forging another identity.
  it('changes with the pepper', () => {
    const before = hashToken('abc')
    process.env.IDENTITY_PEPPER = 'a-different-pepper-value-32-chars-ok'
    const after = hashToken('abc')
    process.env.IDENTITY_PEPPER = 'test-pepper-value-at-least-32-chars-long'
    expect(after).not.toBe(before)
  })

  it('throws when the pepper is missing rather than hashing unpeppered', () => {
    const saved = process.env.IDENTITY_PEPPER
    delete process.env.IDENTITY_PEPPER
    expect(() => hashToken('abc')).toThrow(/IDENTITY_PEPPER/)
    process.env.IDENTITY_PEPPER = saved
  })
})

describe('deriveHandle', () => {
  it('is deterministic for the same hash', () => {
    const h = hashToken('user-one')
    expect(deriveHandle(h)).toEqual(deriveHandle(h))
  })

  it('produces "Adjective Animal NN" format', () => {
    const { name } = deriveHandle(hashToken('user-one'))
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/)
  })

  it('returns a hex color', () => {
    const { color } = deriveHandle(hashToken('user-one'))
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('gives different handles to different users', () => {
    const a = deriveHandle(hashToken('user-one')).name
    const b = deriveHandle(hashToken('user-two')).name
    expect(a).not.toBe(b)
  })

  // A marigold-adjacent handle would read as an admin badge.
  it('only ever returns a color from the design.md author palette', () => {
    for (let i = 0; i < 500; i++) {
      const { color } = deriveHandle(hashToken(`user-${i}`))
      expect(AUTHOR_COLORS).toContain(color)
    }
  })

  it('never returns a reserved token color', () => {
    const reserved = ['#2C5F8F', '#C8503F', '#E5A03A', '#6E645C']
    for (const c of AUTHOR_COLORS) {
      expect(reserved).not.toContain(c.toUpperCase())
    }
  })

  // A color-word adjective would contradict the rendered color.
  it('uses no color words as adjectives', () => {
    const colorWords = [
      'teal', 'amber', 'cobalt', 'rust', 'olive', 'plum', 'coral', 'indigo',
      'sage', 'copper', 'mauve', 'ochre', 'cyan', 'crimson', 'jade', 'violet',
      'magenta', 'fern', 'slate',
    ]
    for (let i = 0; i < 300; i++) {
      const adjective = deriveHandle(hashToken(`u${i}`)).name.split(' ')[0]
      expect(colorWords).not.toContain(adjective.toLowerCase())
    }
  })

  it('spreads users across the whole palette rather than favouring one slot', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) seen.add(deriveHandle(hashToken(`u${i}`)).color)
    expect(seen.size).toBe(AUTHOR_COLORS.length)
  })
})
