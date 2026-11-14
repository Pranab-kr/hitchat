import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { RoomDelete } from '../components/room/room-delete'

// The control must appear exactly when the action would allow the delete. The action's
// own verdict is covered against the live database in rooms-actions.test.ts; here the
// question is whether the button is offered at all, which is what a student sees.
const mocks = vi.hoisted(() => ({
  canDeleteRoom: vi.fn(),
  deleteRoom: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('@/app/actions/rooms', () => ({
  canDeleteRoom: mocks.canDeleteRoom,
  deleteRoom: mocks.deleteRoom,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.canDeleteRoom.mockResolvedValue({ ok: true, data: { canDelete: false } })
})

afterEach(cleanup)

function renderRoom(props: { canDelete: boolean; creatorIsAnon: boolean }) {
  return render(
    <RoomDelete groupId="g-1" label="A" canDelete={props.canDelete} creatorIsAnon={props.creatorIsAnon} />,
  )
}

describe('RoomDelete', () => {
  it('offers nothing when the viewer neither created the room nor owns the site', async () => {
    renderRoom({ canDelete: false, creatorIsAnon: false })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('button', { name: 'delete room' })).not.toBeInTheDocument()
    expect(mocks.canDeleteRoom).not.toHaveBeenCalled()
  })

  it('offers the control straight away to the owner', async () => {
    renderRoom({ canDelete: true, creatorIsAnon: false })

    expect(await screen.findByRole('button', { name: 'delete room' })).toBeInTheDocument()
    expect(mocks.canDeleteRoom).not.toHaveBeenCalled()
  })

  it('asks the server once for an anonymously created room and shows the control on yes', async () => {
    mocks.canDeleteRoom.mockResolvedValue({ ok: true, data: { canDelete: true } })

    renderRoom({ canDelete: false, creatorIsAnon: true })

    expect(await screen.findByRole('button', { name: 'delete room' })).toBeInTheDocument()
    // The token minted by useAnonToken is what proves ownership, so it has to be sent.
    expect(mocks.canDeleteRoom).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g-1', token: expect.any(String) }),
    )
  })

  it('stays hidden when the server says this browser did not create the room', async () => {
    renderRoom({ canDelete: false, creatorIsAnon: true })

    await waitFor(() => expect(mocks.canDeleteRoom).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'delete room' })).not.toBeInTheDocument()
  })

  it('confirms before deleting, then replaces the room with the picker', async () => {
    mocks.deleteRoom.mockResolvedValue({ ok: true, data: null })
    renderRoom({ canDelete: true, creatorIsAnon: false })

    fireEvent.click(await screen.findByRole('button', { name: 'delete room' }))
    expect(screen.getByText('Delete room A and every message in it?')).toBeInTheDocument()
    expect(mocks.deleteRoom).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'delete' }))

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/'))
    expect(mocks.deleteRoom).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g-1' }),
    )
  })

  it('reports a refusal and keeps the room on screen', async () => {
    mocks.deleteRoom.mockResolvedValue({
      ok: false,
      code: 'unauthorized',
      message: 'You can only delete a room you created.',
    })
    renderRoom({ canDelete: true, creatorIsAnon: false })

    fireEvent.click(await screen.findByRole('button', { name: 'delete room' }))
    fireEvent.click(screen.getByRole('button', { name: 'delete' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'You can only delete a room you created.',
    )
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
