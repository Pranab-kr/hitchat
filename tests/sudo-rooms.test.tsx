import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SudoRooms } from '../components/admin/sudo-rooms'

const mocks = vi.hoisted(() => ({
  deleteRoom: vi.fn(),
}))

vi.mock('@/app/actions/rooms', () => ({
  deleteRoom: mocks.deleteRoom,
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

const departments = [
  {
    id: 'd1',
    name: 'CSE',
    slug: 'cse',
    years: [
      {
        id: 'y1',
        number: 2,
        batches: [
          {
            id: 'b1',
            number: 2,
            groups: [
              { id: 'g1', label: 'A', createdByAdminId: 'owner', creatorIsAnon: false },
              { id: 'g2', label: 'B', createdByAdminId: 'co', creatorIsAnon: false },
            ],
          },
        ],
      },
    ],
  },
]

describe('SudoRooms', () => {
  it('removes a deleted room locally without refreshing the page', async () => {
    mocks.deleteRoom.mockResolvedValue({ ok: true, data: null })
    render(<SudoRooms departments={departments} session={{ adminId: 'owner', role: 'owner' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'delete room A' }))
    fireEvent.click(screen.getByRole('button', { name: 'delete A' }))

    await waitFor(() => expect(screen.queryByText(/batch 2 \(A, B\)/)).not.toBeInTheDocument())
    expect(screen.getByText(/year 2 — batch 2/)).toBeInTheDocument()
    expect(mocks.deleteRoom).toHaveBeenCalledWith({ groupId: 'g1' })
  })

  it('shows only rooms the current co-admin can delete', () => {
    render(<SudoRooms departments={departments} session={{ adminId: 'co', role: 'co_admin' }} />)

    expect(screen.queryByRole('button', { name: 'delete room A' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'delete room B' })).toBeInTheDocument()
  })
})
