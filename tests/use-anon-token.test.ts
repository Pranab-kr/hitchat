import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnonToken } from '../lib/use-anon-token'

beforeEach(() => localStorage.clear())

describe('useAnonToken', () => {
  it('mints a token on first use', () => {
    const { result } = renderHook(() => useAnonToken())
    expect(result.current.token).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reuses the same token across mounts', () => {
    const first = renderHook(() => useAnonToken()).result.current.token
    const second = renderHook(() => useAnonToken()).result.current.token
    expect(second).toBe(first)
  })

  it('issues a different token after reroll', () => {
    const { result } = renderHook(() => useAnonToken())
    const before = result.current.token
    act(() => result.current.reroll())
    expect(result.current.token).not.toBe(before)
  })

  it('persists the minted token so a later mount reads it back', () => {
    const { result } = renderHook(() => useAnonToken())
    expect(localStorage.getItem('hitchat:token')).toBe(result.current.token)
  })

  it('propagates a reroll to a second live hook', () => {
    const a = renderHook(() => useAnonToken())
    const b = renderHook(() => useAnonToken())
    expect(b.result.current.token).toBe(a.result.current.token)

    act(() => a.result.current.reroll())
    expect(b.result.current.token).toBe(a.result.current.token)
  })
})
