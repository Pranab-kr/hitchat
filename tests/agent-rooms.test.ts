// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testDb as db, seedRoom, teardownRoom, type SeededRoom } from './helpers/seed-room'

let room: SeededRoom

beforeAll(async () => {
  room = await seedRoom()
})

afterAll(async () => {
  await teardownRoom(room)
})

describe('parseRoomPath', () => {
  it('parses cse/3/2/A', async () => {
    const { parseRoomPath } = await import('../lib/agent/rooms')
    expect(parseRoomPath('cse/3/2/A')).toEqual({
      dept: 'cse',
      year: 3,
      batch: 2,
      group: 'A',
    })
  })

  it('normalises case so the browser URL works as typed', async () => {
    const { parseRoomPath } = await import('../lib/agent/rooms')
    expect(parseRoomPath('CSE/3/2/a')).toEqual({
      dept: 'cse',
      year: 3,
      batch: 2,
      group: 'A',
    })
  })

  it('rejects a non-numeric year', async () => {
    const { parseRoomPath } = await import('../lib/agent/rooms')
    expect(parseRoomPath('cse/three/2/A')).toBeNull()
  })

  it('rejects a path with three or five segments', async () => {
    const { parseRoomPath } = await import('../lib/agent/rooms')
    expect(parseRoomPath('cse/3/2')).toBeNull()
    expect(parseRoomPath('cse/3/2/A/extra')).toBeNull()
  })

  it('rejects an empty string', async () => {
    const { parseRoomPath } = await import('../lib/agent/rooms')
    expect(parseRoomPath('')).toBeNull()
    expect(parseRoomPath('///')).toBeNull()
  })
})

describe('listRooms', () => {
  it('lists the seeded room as <slug>/1/1/A, unlocked', async () => {
    const { listRooms } = await import('../lib/agent/rooms')
    const rooms = await listRooms()
    const mine = rooms.find((r) => r.path === `${room.deptSlug}/1/1/A`)

    expect(mine).toEqual({
      path: `${room.deptSlug}/1/1/A`,
      dept: room.deptSlug,
      year: 1,
      batch: 1,
      group: 'A',
      locked: false,
    })
  })

  it('reports a locked room as locked', async () => {
    await db.from('groups').update({ is_locked: true }).eq('id', room.groupId)

    const { listRooms } = await import('../lib/agent/rooms')
    const rooms = await listRooms()
    const mine = rooms.find((r) => r.path === `${room.deptSlug}/1/1/A`)

    await db.from('groups').update({ is_locked: false }).eq('id', room.groupId)

    expect(mine?.locked).toBe(true)
  })
})

describe('resolveRoom', () => {
  it('returns the room and the parsed path parts', async () => {
    const { resolveRoom } = await import('../lib/agent/rooms')
    const resolved = await resolveRoom(`${room.deptSlug}/1/1/a`)

    expect(resolved).toMatchObject({
      id: room.groupId,
      label: 'A',
      dept: room.deptSlug,
      year: 1,
      batch: 1,
      group: 'A',
      isLocked: false,
    })
  })

  it('returns null for an unknown room', async () => {
    const { resolveRoom } = await import('../lib/agent/rooms')
    expect(await resolveRoom('no-such-dept/1/1/A')).toBeNull()
  })

  it('returns null for a malformed path', async () => {
    const { resolveRoom } = await import('../lib/agent/rooms')
    expect(await resolveRoom('nonsense')).toBeNull()
  })
})
