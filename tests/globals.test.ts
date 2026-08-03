import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

describe('design tokens', () => {
  it('defines the six light-theme tokens with exact design.md values', () => {
    expect(css).toContain('--paper: #FAF5F1')
    expect(css).toContain('--ink: #241E1A')
    expect(css).toContain('--pen: #2C5F8F')
    expect(css).toContain('--rule: #C8503F')
    expect(css).toContain('--marigold: #E5A03A')
    expect(css).toContain('--graphite: #6E645C')
  })

  it('defines the six dark-theme tokens with exact design.md values', () => {
    expect(css).toContain('--desk: #1A1613')
    expect(css).toContain('--chalk: #EDE6DE')
    expect(css).toContain('--pen: #7FB0DC')
    expect(css).toContain('--rule: #D9705F')
    expect(css).toContain('--marigold: #F0B657')
    expect(css).toContain('--graphite: #9A8F86')
  })

  it('uses class-based dark mode, not the media query', () => {
    expect(css).toContain('@custom-variant dark')
    expect(css).not.toContain('prefers-color-scheme')
  })

  it('aliases tokens through @theme inline so they can be swapped at runtime', () => {
    expect(css).toContain('@theme inline')
    expect(css).toContain('--color-paper: var(--paper)')
  })
})
