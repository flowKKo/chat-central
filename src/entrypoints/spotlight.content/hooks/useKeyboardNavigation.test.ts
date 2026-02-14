import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardNavigation } from './useKeyboardNavigation'

describe('useKeyboardNavigation', () => {
  const defaultProps = {
    itemCount: 5,
    onSelect: vi.fn(),
    onModSelect: vi.fn(),
    onClose: vi.fn(),
    isVisible: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup any lingering event listeners by re-rendering with isVisible=false
  })

  function fireKeyDown(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    })
    document.dispatchEvent(event)
  }

  it('should start with selectedIndex 0', () => {
    const { result } = renderHook(() => useKeyboardNavigation(defaultProps))
    expect(result.current.selectedIndex).toBe(0)
  })

  it('should move down on ArrowDown', () => {
    const { result } = renderHook(() => useKeyboardNavigation(defaultProps))

    act(() => fireKeyDown('ArrowDown'))
    expect(result.current.selectedIndex).toBe(1)

    act(() => fireKeyDown('ArrowDown'))
    expect(result.current.selectedIndex).toBe(2)
  })

  it('should not go below itemCount - 1', () => {
    const { result } = renderHook(() => useKeyboardNavigation({ ...defaultProps, itemCount: 2 }))

    act(() => fireKeyDown('ArrowDown'))
    expect(result.current.selectedIndex).toBe(1)

    act(() => fireKeyDown('ArrowDown'))
    expect(result.current.selectedIndex).toBe(1)
  })

  it('should move up on ArrowUp', () => {
    const { result } = renderHook(() => useKeyboardNavigation(defaultProps))

    act(() => fireKeyDown('ArrowDown'))
    act(() => fireKeyDown('ArrowDown'))
    expect(result.current.selectedIndex).toBe(2)

    act(() => fireKeyDown('ArrowUp'))
    expect(result.current.selectedIndex).toBe(1)
  })

  it('should not go above 0', () => {
    const { result } = renderHook(() => useKeyboardNavigation(defaultProps))

    act(() => fireKeyDown('ArrowUp'))
    expect(result.current.selectedIndex).toBe(0)
  })

  it('should call onSelect on Enter', () => {
    renderHook(() => useKeyboardNavigation(defaultProps))

    act(() => fireKeyDown('ArrowDown'))
    act(() => fireKeyDown('Enter'))

    expect(defaultProps.onSelect).toHaveBeenCalledWith(1)
  })

  it('should call onModSelect on Cmd+Enter', () => {
    renderHook(() => useKeyboardNavigation(defaultProps))

    act(() => fireKeyDown('Enter', { metaKey: true }))

    expect(defaultProps.onModSelect).toHaveBeenCalledWith(0)
    expect(defaultProps.onSelect).not.toHaveBeenCalled()
  })

  it('should call onModSelect on Ctrl+Enter', () => {
    renderHook(() => useKeyboardNavigation(defaultProps))

    act(() => fireKeyDown('Enter', { ctrlKey: true }))

    expect(defaultProps.onModSelect).toHaveBeenCalledWith(0)
  })

  it('should call onClose on Escape', () => {
    renderHook(() => useKeyboardNavigation(defaultProps))

    act(() => fireKeyDown('Escape'))

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should reset selectedIndex when itemCount changes', () => {
    const { result, rerender } = renderHook((props) => useKeyboardNavigation(props), {
      initialProps: defaultProps,
    })

    act(() => fireKeyDown('ArrowDown'))
    act(() => fireKeyDown('ArrowDown'))
    expect(result.current.selectedIndex).toBe(2)

    rerender({ ...defaultProps, itemCount: 3 })
    expect(result.current.selectedIndex).toBe(0)
  })

  it('should not respond to keys when not visible', () => {
    renderHook(() => useKeyboardNavigation({ ...defaultProps, isVisible: false }))

    act(() => fireKeyDown('Enter'))
    act(() => fireKeyDown('Escape'))

    expect(defaultProps.onSelect).not.toHaveBeenCalled()
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('should not call onSelect when itemCount is 0', () => {
    renderHook(() => useKeyboardNavigation({ ...defaultProps, itemCount: 0 }))

    act(() => fireKeyDown('Enter'))

    expect(defaultProps.onSelect).not.toHaveBeenCalled()
  })

  it('should allow manual setSelectedIndex', () => {
    const { result } = renderHook(() => useKeyboardNavigation(defaultProps))

    act(() => result.current.setSelectedIndex(3))
    expect(result.current.selectedIndex).toBe(3)
  })
})
