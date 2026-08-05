// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { highlightCode, loadedLanguages } from '../lib/highlight'
import { ALLOWED_LANGS } from '../lib/validate'

describe('highlightCode', () => {
  it('emits dual-theme CSS variables, not hardcoded colors', async () => {
    const html = await highlightCode('int main(){}', 'c')
    expect(html).toContain('--shiki-light')
    expect(html).toContain('--shiki-dark')
  })

  it('wraps each line so CSS counters can number them', async () => {
    const html = await highlightCode('line one\nline two', 'c')
    expect(html.match(/class="line"/g)).toHaveLength(2)
  })

  it('falls back to plaintext for an unknown language', async () => {
    const html = await highlightCode('some text', 'brainfuck')
    expect(html).toContain('<pre')
  })

  // A grammar missing from lib/highlight.ts does not throw — highlightCode silently
  // substitutes plaintext. So "it returned <pre>" would pass for a language that never
  // loaded. These compare against the plaintext rendering of the same source: real
  // tokenization produces more spans and more distinct colors than plaintext does.
  it.each([
    ['html', '<div class="x">hi</div>', 'div'],
    ['css', '.btn { color: red; }\n/* note */', 'color'],
    ['verilog', 'module counter(input clk); endmodule', 'module'],
  ])('actually tokenizes %s, not just plaintext', async (lang, code, keyword) => {
    const html = await highlightCode(code, lang)
    const plain = await highlightCode(code, 'plaintext')

    // Distinct token colors, not span count: plaintext also emits one span per line,
    // so a two-line sample has the same span count either way. A real grammar is the
    // only thing that paints different tokens different colors.
    const colorsIn = (s: string) =>
      new Set(s.match(/--shiki-light:\s*[^;"]+/g) ?? []).size

    expect(colorsIn(plain)).toBe(1)
    expect(colorsIn(html)).toBeGreaterThan(1)
    expect(html).not.toBe(plain)
    expect(html).toContain(keyword)
  })

  it('loads a grammar for every non-plaintext ALLOWED_LANGS entry', async () => {
    // Catches the drift migration 0008 could introduce: a language allowed by
    // validate.ts and the DB but with no grammar imported ships as dead plaintext,
    // and nothing else in the suite would notice.
    const loaded = await loadedLanguages()
    const missing = ALLOWED_LANGS.filter(
      (l) => l !== 'plaintext' && !loaded.includes(l),
    )
    expect(missing, `no Shiki grammar loaded for: ${missing.join(', ')}`).toEqual([])
  })

  it('escapes HTML so pasted code cannot inject markup', async () => {
    const html = await highlightCode(
      '<script>alert(1)</script> & <img src=x onerror="alert(2)">',
      'plaintext',
    )
    expect(html).not.toMatch(/<script|<img/i)

    // Shiki emits &#x3C;, not &lt;. Assert the property — no raw '<' survives in the
    // text content — rather than a particular entity spelling.
    const text = html.replace(/<\/?(pre|code|span)[^>]*>/g, '')
    expect(text).not.toContain('<')
    expect(text).toContain('&#x3C;script')
  })
})
