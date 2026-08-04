// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { highlightCode } from '../lib/highlight'

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
