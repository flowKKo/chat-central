import { useCallback, useEffect, useState } from 'react'

interface UseKeyboardNavigationOptions {
  itemCount: number
  onSelect: (index: number) => void
  onModSelect: (index: number) => void
  onClose: () => void
  isVisible: boolean
  /** When this changes, selectedIndex resets to 0. Use to signal fresh results (not appends). */
  resultsVersion: number
}

interface UseKeyboardNavigationReturn {
  selectedIndex: number
  setSelectedIndex: (i: number) => void
}

export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onModSelect,
  onClose,
  isVisible,
  resultsVersion,
}: UseKeyboardNavigationOptions): UseKeyboardNavigationReturn {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Reset selection on fresh results or when spotlight opens (not on load-more appends)
  useEffect(() => {
    setSelectedIndex(0)
  }, [resultsVersion, isVisible])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev))
          break

        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break

        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          if (itemCount > 0) {
            if (e.metaKey || e.ctrlKey) {
              onModSelect(selectedIndex)
            } else {
              onSelect(selectedIndex)
            }
          }
          break

        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          onClose()
          break
      }
    },
    [isVisible, itemCount, selectedIndex, onSelect, onModSelect, onClose]
  )

  useEffect(() => {
    if (!isVisible) return
    // Use capture phase to intercept before host page handlers
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isVisible, handleKeyDown])

  return { selectedIndex, setSelectedIndex }
}
