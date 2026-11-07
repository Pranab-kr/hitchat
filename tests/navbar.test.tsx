import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { Navbar } from '../components/navbar'

let currentPath = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}))

vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">◐</button>,
}))

afterEach(() => {
  cleanup()
  currentPath = '/'
  window.scrollY = 0
})

describe('Navbar', () => {
  it('renders brand logo, Agent docs link, SUDO link, and ThemeToggle on home page', () => {
    currentPath = '/'
    render(<Navbar />)

    const homeLink = screen.getByRole('link', { name: /hitchat home/i })
    expect(homeLink).toHaveAttribute('href', '/')

    const agentBtn = screen.getByRole('link', { name: /agent docs/i })
    expect(agentBtn).toHaveAttribute('href', '/agent')
    expect(agentBtn).not.toHaveAttribute('aria-current')

    const sudoBtn = screen.getByRole('link', { name: /sudo/i })
    expect(sudoBtn).toHaveAttribute('href', '/sudo')
    expect(sudoBtn).not.toHaveAttribute('aria-current')

    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
  })

  it('hides border at top of page, and reveals floating island border on scroll', () => {
    currentPath = '/'
    const { container } = render(<Navbar />)

    const island = container.querySelector('.rounded-full')!
    expect(island.className).toContain('border-transparent')
    expect(island.className).toContain('bg-transparent')
    expect(island.className).toContain('scale-100')

    // Simulate scrolling down
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 40, writable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    expect(island.className).toContain('border-hairline')
    expect(island.className).toContain('bg-paper/85')
    expect(island.className).toContain('scale-[0.98]')
    expect(island.className).toContain('translate-y-2')

    // Simulate scrolling back to top
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    expect(island.className).toContain('border-transparent')
    expect(island.className).toContain('bg-transparent')
  })

  it('marks Agent docs with aria-current="page" when on /agent', () => {
    currentPath = '/agent'
    render(<Navbar />)

    const agentBtn = screen.getByRole('link', { name: /agent docs/i })
    expect(agentBtn).toHaveAttribute('aria-current', 'page')

    const sudoBtn = screen.getByRole('link', { name: /sudo/i })
    expect(sudoBtn).not.toHaveAttribute('aria-current')
  })

  it('marks SUDO with aria-current="page" when on /sudo or /sudo/admins', () => {
    currentPath = '/sudo'
    const { rerender } = render(<Navbar />)

    expect(screen.getByRole('link', { name: /sudo/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: /agent docs/i })).not.toHaveAttribute(
      'aria-current',
    )

    currentPath = '/sudo/admins'
    rerender(<Navbar />)
    expect(screen.getByRole('link', { name: /sudo/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders nothing on in-room pages (/c/...)', () => {
    currentPath = '/c/it/3/2/a'
    const { container } = render(<Navbar />)

    expect(container).toBeEmptyDOMElement()
  })
})
