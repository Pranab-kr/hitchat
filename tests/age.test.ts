import { describe, it, expect } from 'vitest'
import { ageOpacity } from '../lib/age'

const HOUR = 60 * 60 * 1000
const now = Date.UTC(2026, 7, 4, 12, 0, 0)
const agoHours = (h: number) => new Date(now - h * HOUR).toISOString()

// WCAG 2.x relative luminance and contrast, per the official formula. Same math the
// design tokens were verified with — see design.md "Color". These are hard floors:
// the fade must never push body text below 4.5:1 on either theme.
function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const linear = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// A message at opacity `o` composites against the page background, so its effective
// color is o*ink + (1-o)*background. Same derivation the floor amendment used.
function faded(inkHex: string, bgHex: string, o: number): string {
  const ink = [0, 2, 4].map((i) => parseInt(inkHex.slice(i, i + 2), 16))
  const bg = [0, 2, 4].map((i) => parseInt(bgHex.slice(i, i + 2), 16))
  return ink
    .map((v, i) => Math.round(o * v + (1 - o) * bg[i]).toString(16).padStart(2, '0'))
    .join('')
}

const LIGHT_INK = '241E1A' // --ink
const LIGHT_BG = 'FAF5F1' // --paper
const DARK_INK = 'EDE6DE' // --chalk is --ink's dark value
const DARK_BG = '1A1613' // --desk is --paper's dark value
const AA = 4.5

describe('ageOpacity', () => {
  it('is fully opaque for a fresh message', () => {
    expect(ageOpacity(agoHours(0), now)).toBe(1)
  })

  it('stays fully opaque through the first 2 hours', () => {
    expect(ageOpacity(agoHours(1.9), now)).toBe(1)
  })

  it('steps down at each documented threshold in light mode', () => {
    expect(ageOpacity(agoHours(2.5), now)).toBe(0.85)
    expect(ageOpacity(agoHours(4.5), now)).toBe(0.7)
    expect(ageOpacity(agoHours(6.5), now)).toBe(0.65)
  })

  it('keeps the designed 0.55 depth in dark mode, where the floor still clears AA', () => {
    expect(ageOpacity(agoHours(6.5), now, true)).toBe(0.55)
  })

  it('never drops below the contrast floor in either theme', () => {
    expect(ageOpacity(agoHours(7.9), now)).toBe(0.65)
    expect(ageOpacity(agoHours(7.9), now, true)).toBe(0.55)
    expect(ageOpacity(agoHours(100), now)).toBe(0.65)
  })

  it('decreases monotonically', () => {
    for (const dark of [false, true]) {
      const values = [0, 2.5, 4.5, 6.5, 7.9].map((h) => ageOpacity(agoHours(h), now, dark))
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1])
      }
    }
  })

  // A clock skew between server and client, or a message inserted with a slightly
  // future created_at, must not produce an opacity above 1.
  it('clamps a future timestamp to fully opaque', () => {
    expect(ageOpacity(new Date(now + HOUR).toISOString(), now)).toBe(1)
  })

  // The hard floor: at every age step in both themes the faded text must clear
  // WCAG AA (4.5:1) against the page background. Measured, not eyeballed — a green
  // suite must never certify a floor that fails real-world rendering.
  it('every fade step clears WCAG AA in light mode', () => {
    const steps = [1, 0.85, 0.7, ageOpacity(agoHours(7.9), now)]
    for (const step of steps) {
      const effective = faded(LIGHT_INK, LIGHT_BG, step)
      expect(contrastRatio(effective, LIGHT_BG)).toBeGreaterThanOrEqual(AA)
    }
  })

  it('every fade step clears WCAG AA in dark mode', () => {
    const steps = [1, 0.85, 0.7, ageOpacity(agoHours(7.9), now, true)]
    for (const step of steps) {
      const effective = faded(DARK_INK, DARK_BG, step)
      expect(contrastRatio(effective, DARK_BG)).toBeGreaterThanOrEqual(AA)
    }
  })

  it('the light floor leaves margin over the AA line, not a bare pass', () => {
    // 0.65 composites to #6F6965 on paper, ~4.99:1. Barely-over-the-line values invite
    // a future re-edit to drift under 4.5:1; the floor should hold ~half a point.
    expect(contrastRatio(faded(LIGHT_INK, LIGHT_BG, 0.65), LIGHT_BG)).toBeGreaterThan(4.8)
  })
})
