// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isToken, resolveToken, tokenFromHeader, tokenFromPath } from '../lib/agent/token'

// A 32-character token, the shape the browser and the CLI both mint.
const TOKEN = '0123456789abcdef0123456789abcdef'

function req(headers: Record<string, string>, url = 'https://hitchat.test/api/agent/rooms') {
  return new Request(url, { headers })
}

describe('isToken', () => {
  it('accepts a 32-character hex token', () => {
    expect(isToken(TOKEN)).toBe(true)
  })

  it('accepts hyphens and underscores', () => {
    expect(isToken('agent-test_2026-11-07-abcdef')).toBe(true)
  })

  it('rejects a token with a trailing newline', () => {
    expect(isToken(`${TOKEN}\n`)).toBe(false)
  })

  it('rejects a token with a space', () => {
    expect(isToken(`${TOKEN} `)).toBe(false)
  })

  it('rejects 15 characters and accepts 16', () => {
    expect(isToken('a'.repeat(15))).toBe(false)
    expect(isToken('a'.repeat(16))).toBe(true)
  })

  it('rejects 129 characters and accepts 128', () => {
    expect(isToken('a'.repeat(129))).toBe(false)
    expect(isToken('a'.repeat(128))).toBe(true)
  })

  it('rejects an empty value and a non-string', () => {
    expect(isToken('')).toBe(false)
    expect(isToken(undefined)).toBe(false)
    expect(isToken(null)).toBe(false)
  })
})

describe('tokenFromHeader', () => {
  it('reads Authorization: Bearer', () => {
    expect(tokenFromHeader(req({ authorization: `Bearer ${TOKEN}` }))).toBe(TOKEN)
  })

  it('reads x-hitchat-token', () => {
    expect(tokenFromHeader(req({ 'x-hitchat-token': TOKEN }))).toBe(TOKEN)
  })

  it('returns null when neither header is present', () => {
    expect(tokenFromHeader(req({}))).toBeNull()
  })

  it('returns null for a malformed bearer value', () => {
    expect(tokenFromHeader(req({ authorization: 'Bearer too-short' }))).toBeNull()
  })

  it('ignores a non-bearer Authorization header and falls back to x-hitchat-token', () => {
    const request = req({ authorization: 'Basic abc', 'x-hitchat-token': TOKEN })
    expect(tokenFromHeader(request)).toBe(TOKEN)
  })
})

describe('tokenFromPath', () => {
  it('reads the last path segment', () => {
    expect(tokenFromPath(`/api/mcp/${TOKEN}`)).toBe(TOKEN)
  })

  it('ignores a trailing slash', () => {
    expect(tokenFromPath(`/api/mcp/${TOKEN}/`)).toBe(TOKEN)
  })

  it('returns null for a malformed segment', () => {
    expect(tokenFromPath('/api/mcp/short')).toBeNull()
  })
})

describe('resolveToken', () => {
  it('prefers the header over the path', () => {
    const request = req({ authorization: `Bearer ${TOKEN}` }, `https://hitchat.test/api/mcp/${'b'.repeat(32)}`)
    expect(resolveToken(request)).toBe(TOKEN)
  })

  it('falls back to the path when there is no header', () => {
    const request = req({}, `https://hitchat.test/api/mcp/${TOKEN}`)
    expect(resolveToken(request)).toBe(TOKEN)
  })
})
