import { describe, expect, it } from 'vitest'
import type { Config } from '../src/config'
import {
  HitchatError,
  listRooms,
  readMessages,
  sendCode,
  sendMessage,
} from '../src/client'

// Every case runs against a stub fetch. The package's job is the wire contract, and the
// live server already has its own tests; a network in the middle would only add flake.

const config: Config = { url: 'http://localhost:3000', token: 'a'.repeat(36) }

type Recorded = { url: string; init: RequestInit }

function stub(reply: () => Response | Promise<Response>) {
  const calls: Recorded[] = []

  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} })
    return reply()
  }

  return { calls, fetchImpl }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const header = (init: RequestInit, name: string) => new Headers(init.headers).get(name)

describe('apiCall', () => {
  it('sends Authorization: Bearer <token> to the configured base URL', async () => {
    const { calls, fetchImpl } = stub(() => json({ ok: true, data: { rooms: [] } }))

    await listRooms(config, fetchImpl)

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://localhost:3000/api/agent/rooms')
    expect(header(calls[0].init, 'authorization')).toBe(`Bearer ${config.token}`)
  })

  it('joins a base URL that already ends in a slash without doubling it', async () => {
    const { calls, fetchImpl } = stub(() => json({ ok: true, data: { rooms: [] } }))

    await listRooms({ ...config, url: 'http://localhost:3000/' }, fetchImpl)

    expect(calls[0].url).toBe('http://localhost:3000/api/agent/rooms')
  })

  it('throws HitchatError with the server code, message and retryAfter on 429', async () => {
    const { fetchImpl } = stub(() =>
      json(
        { ok: false, code: 'rate_limited', message: 'You are posting too fast.', retryAfter: 7 },
        429,
      ),
    )

    const error = await sendMessage(config, { room: 'cse/3/2/A', text: 'hi' }, fetchImpl).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(HitchatError)
    const failure = error as HitchatError
    expect(failure.code).toBe('rate_limited')
    expect(failure.message).toBe('You are posting too fast.')
    expect(failure.retryAfter).toBe(7)
  })

  it('falls back to the Retry-After header when the body omits retryAfter', async () => {
    const { fetchImpl } = stub(
      () =>
        new Response(JSON.stringify({ ok: false, code: 'rate_limited', message: 'Slow down.' }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '3' },
        }),
    )

    const error = (await sendMessage(config, { room: 'cse/3/2/A', text: 'hi' }, fetchImpl).catch(
      (caught: unknown) => caught,
    )) as HitchatError

    expect(error.retryAfter).toBe(3)
  })

  it('throws HitchatError with code "network" when fetch rejects', async () => {
    const { fetchImpl } = stub(() => {
      throw new Error('ECONNREFUSED')
    })

    const error = (await listRooms(config, fetchImpl).catch((caught: unknown) => caught)) as HitchatError

    expect(error).toBeInstanceOf(HitchatError)
    expect(error.code).toBe('network')
    expect(error.message).toContain('http://localhost:3000')
  })

  it('throws a server error when the reply is not a hitchat envelope', async () => {
    const { fetchImpl } = stub(() => new Response('<html>not hitchat</html>', { status: 502 }))

    const error = (await listRooms(config, fetchImpl).catch((caught: unknown) => caught)) as HitchatError

    expect(error).toBeInstanceOf(HitchatError)
    expect(error.code).toBe('server')
  })
})

describe('listRooms / readMessages', () => {
  it('unwraps data.rooms', async () => {
    const room = { path: 'cse/3/2/A', dept: 'cse', year: 3, batch: 2, group: 'A', locked: false }
    const { fetchImpl } = stub(() => json({ ok: true, data: { rooms: [room] } }))

    expect(await listRooms(config, fetchImpl)).toEqual([room])
  })

  it('unwraps data.messages and passes room and limit in the query', async () => {
    const { calls, fetchImpl } = stub(() => json({ ok: true, data: { room: 'cse/3/2/A', messages: [] } }))

    await readMessages(config, 'cse/3/2/A', 5, fetchImpl)

    const url = new URL(calls[0].url)
    expect(url.pathname).toBe('/api/agent/messages')
    expect(url.searchParams.get('room')).toBe('cse/3/2/A')
    expect(url.searchParams.get('limit')).toBe('5')
  })

  it('omits limit when the caller did not ask for one', async () => {
    const { calls, fetchImpl } = stub(() => json({ ok: true, data: { room: 'cse/3/2/A', messages: [] } }))

    await readMessages(config, 'cse/3/2/A', undefined, fetchImpl)

    expect(new URL(calls[0].url).searchParams.has('limit')).toBe(false)
  })
})

describe('sendMessage / sendCode', () => {
  it('posts to /api/agent/messages with room, text and reply_to_id', async () => {
    const sent = { id: 'm1', room: 'cse/3/2/A', url: 'http://x/c/cse/3/2/a', expires_at: 'soon' }
    const { calls, fetchImpl } = stub(() => json({ ok: true, data: sent }))

    const result = await sendMessage(
      config,
      { room: 'cse/3/2/A', text: 'hello', reply_to_id: 'r1' },
      fetchImpl,
    )

    expect(result).toEqual(sent)
    expect(calls[0].init.method).toBe('POST')
    expect(new URL(calls[0].url).pathname).toBe('/api/agent/messages')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      room: 'cse/3/2/A',
      text: 'hello',
      reply_to_id: 'r1',
    })
  })

  it('posts code to /api/agent/code with lang, title and lab_tag', async () => {
    const sent = { id: 'm2', room: 'cse/3/2/A', url: 'http://x/c/cse/3/2/a', expires_at: 'soon' }
    const { calls, fetchImpl } = stub(() => json({ ok: true, data: sent }))

    await sendCode(
      config,
      { room: 'cse/3/2/A', code: 'print(1)', lang: 'python', title: 'T', lab_tag: 'Lab 3' },
      fetchImpl,
    )

    expect(new URL(calls[0].url).pathname).toBe('/api/agent/code')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      room: 'cse/3/2/A',
      code: 'print(1)',
      lang: 'python',
      title: 'T',
      lab_tag: 'Lab 3',
    })
  })
})
