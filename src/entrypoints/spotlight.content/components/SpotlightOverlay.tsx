import type { ReactNode } from 'react'
import { useCallback } from 'react'

interface SpotlightOverlayProps {
  children: ReactNode
  onClose: () => void
}

export function SpotlightOverlay({ children, onClose }: SpotlightOverlayProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close when clicking the backdrop itself, not the dialog
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  return (
    <div className="spotlight-backdrop" onClick={handleBackdropClick} role="presentation">
      <div className="spotlight-dialog" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}
