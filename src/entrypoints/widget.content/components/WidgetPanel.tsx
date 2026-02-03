import { useCallback, useEffect, useRef } from 'react'
import { browser } from 'wxt/browser'

interface WidgetPanelProps {
  onClose: () => void
}

export function WidgetPanel({ onClose }: WidgetPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Click-outside close (within Shadow DOM)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !e.composedPath().includes(panelRef.current)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [onClose])

  // Escape key close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const openDashboard = useCallback(() => {
    browser.runtime.sendMessage({ action: 'GET_SYNC_STATUS' }).catch(() => {})
    const manageUrl = browser.runtime.getURL('/manage.html#/conversations')
    window.open(manageUrl, '_blank')
  }, [])

  const openSettings = useCallback(() => {
    const settingsUrl = browser.runtime.getURL('/manage.html#/settings')
    window.open(settingsUrl, '_blank')
  }, [])

  return (
    <div
      ref={panelRef}
      className="widget-panel fixed z-[2147483646] flex flex-col gap-1.5 rounded-l-2xl border border-r-0 border-border/50 bg-card/80 p-2 shadow-xl backdrop-blur-xl"
      style={{ right: 0, top: '50%', transform: 'translateY(-50%)' }}
    >
      <button
        type="button"
        onClick={openDashboard}
        className="widget-panel-btn flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
        title="Dashboard"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
        </svg>
      </button>

      <div className="mx-auto h-px w-5 bg-border/60" />

      <button
        type="button"
        onClick={openSettings}
        className="widget-panel-btn flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
        title="Settings"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  )
}
