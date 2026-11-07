import { describe, expect, it } from 'vitest'
import { resolveOrigin } from '../lib/site-origin'

// /agent prints the URL a person will paste into an editor or a connector, so the origin
// has to be the one other machines can reach. A page that trusts the request alone will
// advertise http://localhost:3000 to anyone browsing a local build, which is useless in a
// pasted config.

describe('resolveOrigin', () => {
  it('uses an explicit SITE_URL first and drops a trailing slash', () => {
    expect(
      resolveOrigin({
        siteUrl: 'https://chat.pranabkr.in/',
        forwardedHost: 'localhost:3000',
        forwardedProto: 'http',
      }),
    ).toBe('https://chat.pranabkr.in')
  })

  it('accepts an explicit SITE_URL that has no scheme', () => {
    expect(resolveOrigin({ siteUrl: 'chat.pranabkr.in' })).toBe('https://chat.pranabkr.in')
  })

  it("falls back to the platform's production host over https", () => {
    expect(resolveOrigin({ platformHost: 'hitchat.vercel.app' })).toBe('https://hitchat.vercel.app')
  })

  it('prefers the forwarded host and proto when they are present', () => {
    expect(
      resolveOrigin({ forwardedHost: 'chat.pranabkr.in', host: 'internal:3000', forwardedProto: 'https' }),
    ).toBe('https://chat.pranabkr.in')
  })

  it('takes the first entry of a comma-separated proxy list', () => {
    expect(
      resolveOrigin({ forwardedHost: 'chat.pranabkr.in, edge-1.internal', forwardedProto: 'https, http' }),
    ).toBe('https://chat.pranabkr.in')
  })

  it('assumes https for a public host that arrives without a proto header', () => {
    expect(resolveOrigin({ host: 'chat.pranabkr.in' })).toBe('https://chat.pranabkr.in')
  })

  it('keeps http for a local host so a dev build stays usable', () => {
    expect(resolveOrigin({ host: 'localhost:3000' })).toBe('http://localhost:3000')
    expect(resolveOrigin({ host: '127.0.0.1:3000' })).toBe('http://127.0.0.1:3000')
  })

  it('falls back to localhost when there is nothing at all', () => {
    expect(resolveOrigin({})).toBe('http://localhost:3000')
  })

  it('ignores an empty SITE_URL rather than printing a bare scheme', () => {
    expect(resolveOrigin({ siteUrl: '   ', host: 'chat.pranabkr.in' })).toBe('https://chat.pranabkr.in')
  })
})
