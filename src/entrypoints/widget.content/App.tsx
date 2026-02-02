import { useCallback, useState } from 'react'
import { storage } from 'wxt/storage'
import type { Config, Platform } from '@/types'
import { FloatingButton } from './components/FloatingButton'
import { WidgetPanel } from './components/WidgetPanel'

interface AppProps {
  platform: Platform
  onRemove: () => void
}

export function App({ platform, onRemove }: AppProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const handleFabClick = useCallback(() => {
    setIsPanelOpen((prev) => !prev)
  }, [])

  // Hide widget for this page session only — no config change
  const handleDismiss = useCallback(() => {
    onRemove()
  }, [onRemove])

  // Persist widget disabled across all pages via config
  const handleDisableGlobally = useCallback(async () => {
    try {
      const stored = await storage.getItem<Config>('local:config')
      const config = stored ?? ({} as Config)
      await storage.setItem('local:config', {
        ...config,
        widget: { enabled: false },
      })
    } catch {
      // Best-effort
    }
    onRemove()
  }, [onRemove])

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false)
  }, [])

  return (
    <>
      <FloatingButton
        platform={platform}
        isPanelOpen={isPanelOpen}
        onClick={handleFabClick}
        onDismiss={handleDismiss}
        onDisableGlobally={handleDisableGlobally}
      />

      {isPanelOpen && <WidgetPanel onClose={handlePanelClose} />}
    </>
  )
}
