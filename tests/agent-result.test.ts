import { describe, it, expect } from 'vitest'
import { err } from '../lib/result'

describe('ActionResult error codes', () => {
  it('carries not_found, the code the agent API needs for a missing room', () => {
    const result = err('not_found', 'No such room.')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('not_found')
    expect(result.message).toBe('No such room.')
  })
})
