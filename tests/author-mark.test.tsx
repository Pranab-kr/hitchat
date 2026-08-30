import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { AuthorMark } from '../components/chat/author-mark'
import { AUTHOR_COLORS } from '../lib/author-color'

afterEach(cleanup)

describe('AuthorMark', () => {
  it('renders a distinct glyph per author slot', () => {
    const { container } = render(
      <>
        {AUTHOR_COLORS.map((c, i) => (
          <AuthorMark key={i} color={c} />
        ))}
      </>,
    )
    const svgs = Array.from(container.querySelectorAll('svg'))
    expect(svgs).toHaveLength(AUTHOR_COLORS.length)
    const shapes = svgs.map((s) => s.innerHTML)
    expect(new Set(shapes).size).toBe(AUTHOR_COLORS.length)
  })

  it('hides the glyph from the accessibility tree — the name does the announcing', () => {
    const { container } = render(<AuthorMark color={AUTHOR_COLORS[0]} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('inherits the theme-aware author color variable', () => {
    const { container } = render(<AuthorMark color={AUTHOR_COLORS[3]} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveStyle({ color: 'var(--author-4)' })
  })
})
