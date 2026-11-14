// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedRoom, teardownRoom, type SeededRoom } from './helpers/seed-room'

let room: SeededRoom

beforeAll(async () => {
  room = await seedRoom()
})

afterAll(async () => {
  await teardownRoom(room)
})

describe('findRoomByPath', () => {
  it('finds a room and returns its label, lock state and department name', async () => {
    const { findRoomByPath } = await import('../lib/rooms-server')
    const hit = await findRoomByPath(room.deptSlug, 1, 1, 'A')

    expect(hit).toEqual({
      id: room.groupId,
      label: 'A',
      isLocked: false,
      deptName: 'Test Dept',
      createdByAdminId: null,
      creatorIsAnon: false,
    })
  })

  it('resolves a mixed-case slug and a lowercase label', async () => {
    const { findRoomByPath } = await import('../lib/rooms-server')
    const hit = await findRoomByPath(room.deptSlug.toUpperCase(), 1, 1, 'a')

    expect(hit?.id).toBe(room.groupId)
    expect(hit?.label).toBe('A')
  })

  it('returns null for a room that does not exist', async () => {
    const { findRoomByPath } = await import('../lib/rooms-server')
    expect(await findRoomByPath('no-such-dept', 1, 1, 'A')).toBeNull()
  })

  it('returns null for a non-integer year or batch', async () => {
    const { findRoomByPath } = await import('../lib/rooms-server')
    expect(await findRoomByPath(room.deptSlug, Number.NaN, 1, 'A')).toBeNull()
    expect(await findRoomByPath(room.deptSlug, 1.5, 1, 'A')).toBeNull()
  })
})
