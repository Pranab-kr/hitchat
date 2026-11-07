// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { err, ok, type ActionErrorCode } from '../lib/result'
import { errorJson, jsonResult } from '../lib/agent/http'

const STATUS: Array<[ActionErrorCode, number]> = [
  ['invalid', 400],
  ['unauthorized', 401],
  ['banned', 403],
  ['locked', 403],
  ['not_found', 404],
  ['rate_limited', 429],
  ['server', 500],
]

describe('jsonResult', () => {
  it('maps every error code to its HTTP status', () => {
    for (const [code, status] of STATUS) {
      expect(jsonResult(err(code, 'x')).status).toBe(status)
    }
  })

  it('returns 200 and the ActionResult shape on success', async () => {
    const result = ok({ id: 'abc', room: 'it/3/2/A' })
    const response = jsonResult(result)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(result)
  })

  it('returns the ActionResult shape on failure', async () => {
    const result = err('invalid', 'Type something first.')
    const response = jsonResult(result)

    expect(await response.json()).toEqual(result)
  })

  it('sets Retry-After from retryAfter', () => {
    const response = jsonResult(err('rate_limited', 'Slow down.', 7))

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('7')
  })

  it('omits Retry-After when there is no retryAfter', () => {
    const response = jsonResult(err('server', 'Nope.'))

    expect(response.headers.get('Retry-After')).toBeNull()
  })

  it('answers with application/json', () => {
    const response = jsonResult(ok(null))
    expect(response.headers.get('Content-Type')).toContain('application/json')
  })
})

describe('errorJson', () => {
  it('builds an error body without a retryAfter key', async () => {
    const response = errorJson('unauthorized', 'No token.')

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      ok: false,
      code: 'unauthorized',
      message: 'No token.',
    })
  })
})
