import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CodeCard } from '../components/chat/code-card'

afterEach(cleanup)

describe('CodeCard', () => {
  it('keeps long code inside the room width and scrolls the code body', () => {
    const code = ['a'.repeat(2_000), ...Array.from({ length: 15 }, () => 'x')].join('\n')
    const { container } = render(
      <CodeCard
        code={code}
        html={'<pre><code>' + code + '</code></pre>'}
        lang="plaintext"
        title="A very long pasted code title that must not widen the room"
      />,
    )

    expect(container.firstElementChild).toHaveClass('min-w-0', 'max-w-full')
    expect(container.querySelector('.overflow-x-auto')).toHaveClass('min-w-0', 'max-w-full')
    expect(container.querySelector('summary')).toHaveTextContent('show 16 lines')
  })
})
