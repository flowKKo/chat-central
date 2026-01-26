import { render, fireEvent, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { useClickOutside } from './useClickOutside'

// Test component that uses the hook
function TestComponent({ onClose }: { onClose: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, isOpen, onClose)

  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      <button type="button" data-testid="outside">
        Outside
      </button>
      {isOpen && (
        <div ref={ref} data-testid="dropdown">
          Dropdown Content
        </div>
      )}
    </div>
  )
}

describe('useClickOutside', () => {
  it('should call onClose when clicking outside the referenced element', () => {
    const onClose = vi.fn()
    render(<TestComponent onClose={onClose} />)

    // Open the dropdown
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByTestId('dropdown')).toBeInTheDocument()

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should not call onClose when clicking inside the referenced element', () => {
    const onClose = vi.fn()
    render(<TestComponent onClose={onClose} />)

    // Open the dropdown
    fireEvent.click(screen.getByText('Open'))

    // Click inside
    fireEvent.mouseDown(screen.getByTestId('dropdown'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('should not call onClose when isOpen is false', () => {
    const onClose = vi.fn()
    render(<TestComponent onClose={onClose} />)

    // Dropdown is not open, click somewhere
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
