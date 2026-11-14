import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CreateForms } from '../components/room/create-forms'

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
}))

vi.mock('@/app/actions/rooms', () => ({
  createRoomForm: mocks.action,
}))

vi.mock('@/lib/use-anon-token', () => ({
  useAnonToken: () => ({ token: 'form-token' }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('CreateForms', () => {
  it('renders one typed room form without hierarchy dropdowns or a label field', () => {
    render(<CreateForms />)

    expect(screen.getByRole('heading', { name: 'New room' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'department' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'year (1–5)' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'batch (1–8)' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'group' })).toBeInTheDocument()
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.queryByRole('textbox', { name: 'label' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Create room' })).toHaveLength(1)
  })
})
