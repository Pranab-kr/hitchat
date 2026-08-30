import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LabFilter } from '../components/room/lab-filter'

afterEach(cleanup)

describe('LabFilter', () => {
  it('renders nothing until the room has a tagged post', () => {
    const { container } = render(<LabFilter tags={[]} active={null} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders All plus one radio per tag, in the given order', () => {
    render(<LabFilter tags={['Lab 2', 'Lab 10']} active={null} onChange={() => {}} />)
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual(['All', 'Lab 2', 'Lab 10'])
  })

  it('marks only the active chip as checked, and All when nothing is selected', () => {
    const { rerender } = render(<LabFilter tags={['Lab 4']} active={null} onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Lab 4' })).not.toBeChecked()

    rerender(<LabFilter tags={['Lab 4']} active="Lab 4" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Lab 4' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked()
  })

  it('reports the chosen tag, and null when All is chosen', () => {
    const onChange = vi.fn()
    render(<LabFilter tags={['Lab 4']} active="Lab 4" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Lab 4' }))
    expect(onChange).toHaveBeenLastCalledWith('Lab 4')

    fireEvent.click(screen.getByRole('radio', { name: 'All' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('moves the selection with the arrow keys (roving radiogroup)', () => {
    const onChange = vi.fn()
    render(<LabFilter tags={['Lab 3', 'Lab 4']} active={null} onChange={onChange} />)
    const group = screen.getByRole('radiogroup')

    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('Lab 3')

    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    // Wraps from All (index 0) back to the last chip.
    expect(onChange).toHaveBeenLastCalledWith('Lab 4')
  })

  it('gives the selected chip the only tab stop', () => {
    render(<LabFilter tags={['Lab 4']} active="Lab 4" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Lab 4' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('tabindex', '-1')
  })
})
