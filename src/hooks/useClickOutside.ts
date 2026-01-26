import { useEffect, type RefObject } from 'react'

/**
 * Hook to detect clicks outside a referenced element and trigger a callback.
 * Only attaches the listener when `isOpen` is true.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ref, isOpen, onClose])
}
