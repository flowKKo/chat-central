import { useEffect, useRef, useState } from 'react'
import type { Platform } from '@/types'

const PLATFORM_BG: Record<Platform, string> = {
  claude: 'hsl(16, 65%, 59%)',
  chatgpt: 'hsl(160, 85%, 35%)',
  gemini: 'hsl(217, 89%, 61%)',
}

interface FloatingButtonProps {
  platform: Platform
  isPanelOpen: boolean
  onClick: () => void
  onDismiss: () => void
  onDisableGlobally: () => void
}

export function FloatingButton({
  platform,
  isPanelOpen,
  onClick,
  onDismiss,
  onDisableGlobally,
}: FloatingButtonProps) {
  const [showCloseMenu, setShowCloseMenu] = useState(false)
  const [hidden, setHidden] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Click outside to close the menu
  // Uses composedPath() to correctly handle Shadow DOM event retargeting
  useEffect(() => {
    if (!showCloseMenu) return
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !e.composedPath().includes(menuRef.current)) {
        setShowCloseMenu(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [showCloseMenu])

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowCloseMenu((prev) => !prev)
  }

  const handleDismiss = () => {
    setHidden(true)
    setShowCloseMenu(false)
    onDismiss()
  }

  const handleDisableGlobally = () => {
    setHidden(true)
    setShowCloseMenu(false)
    onDisableGlobally()
  }

  return (
    <div
      className={`widget-fab-container group fixed z-[2147483646] ${hidden ? 'invisible' : ''}`}
      style={{ right: 0, top: '50%', transform: 'translateY(-50%)' }}
    >
      {/* Close button — appears on hover, hidden when close menu is open */}
      <button
        type="button"
        onClick={handleCloseClick}
        className={`absolute -left-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-foreground/80 text-background transition-opacity duration-200 ${showCloseMenu ? 'pointer-events-none opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
        aria-label="Close widget"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M1 1l6 6M7 1l-6 6" />
        </svg>
      </button>

      {/* Close menu popover */}
      {showCloseMenu && (
        <div
          ref={menuRef}
          className="widget-close-menu absolute right-full top-1/2 mr-2 -translate-y-1/2 rounded-xl border border-border/50 bg-card/90 p-1 shadow-xl backdrop-blur-xl"
          style={{ whiteSpace: 'nowrap' }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
          >
            {/* eye-off */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-muted-foreground"
            >
              <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
              <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
              <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
              <path d="m2 2 20 20" />
            </svg>
            Hide this time
          </button>
          <button
            type="button"
            onClick={handleDisableGlobally}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
          >
            {/* power-off */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-muted-foreground"
            >
              <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
            Disable globally
          </button>
        </div>
      )}

      {/* FAB — half-hidden on the right edge, reveals on hover */}
      <button
        type="button"
        onClick={onClick}
        className="widget-fab flex h-10 w-10 items-center justify-center rounded-l-xl transition-all duration-300 ease-out"
        style={{ backgroundColor: PLATFORM_BG[platform] }}
        aria-label="Open Chat Central"
        data-open={isPanelOpen || showCloseMenu || undefined}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  )
}
