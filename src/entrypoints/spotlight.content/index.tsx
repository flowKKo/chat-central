import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { storage } from 'wxt/storage'
import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/sandbox'
import { createShadowRootUi } from 'wxt/client'
import type { Config } from '@/types'
import { createLogger } from '@/utils/logger'
import { applyThemeToHost } from '@/utils/content-script-theme'
import { initLanguage } from '@/locales'
import { App } from './App'
import styles from './styles/spotlight.css?inline'

const log = createLogger('Spotlight')

/**
 * Direct reference to React's setState for toggling visibility.
 * If a toggle arrives before React mounts, `pendingShow` queues it.
 */
let setVisibleFn: ((updater: (prev: boolean) => boolean) => void) | null = null
let pendingShow = false

function handleToggle() {
  if (setVisibleFn) {
    setVisibleFn((prev) => !prev)
  } else {
    // React hasn't mounted yet — queue the toggle
    pendingShow = !pendingShow
  }
}

export default defineContentScript({
  matches: [
    'https://claude.ai/*',
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://gemini.google.com/*',
  ],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',

  async main(ctx) {
    // Prevent duplicate injection
    if (document.querySelector('chat-central-spotlight')) {
      log.debug('Spotlight already injected, skipping')
      return
    }

    // Register message listener IMMEDIATELY — before any await —
    // so toggles sent right after scripting.executeScript are never missed.
    const handleMessage = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'action' in message &&
        (message as { action: string }).action === 'TOGGLE_SPOTLIGHT'
      ) {
        handleToggle()
      }
    }
    browser.runtime.onMessage.addListener(handleMessage)

    // Check if spotlight is enabled
    const config = await storage.getItem<Config>('local:config')
    if (config?.spotlight?.enabled === false) {
      log.debug('Spotlight disabled by config')
      browser.runtime.onMessage.removeListener(handleMessage)
      return
    }

    initLanguage()
    log.info('Mounting Spotlight')

    const ui = await createShadowRootUi(ctx, {
      name: 'chat-central-spotlight',
      position: 'overlay',
      zIndex: 2147483646,
      onMount(container, shadow) {
        const styleEl = document.createElement('style')
        styleEl.textContent = styles
        shadow.appendChild(styleEl)

        applyThemeToHost(shadow.host as HTMLElement)

        const root = ReactDOM.createRoot(container)

        function SpotlightWrapper() {
          const [isVisible, setIsVisible] = useState(false)

          useEffect(() => {
            // Expose setState to module-level handleToggle
            setVisibleFn = setIsVisible
            // Flush any toggle that arrived before React mounted
            if (pendingShow) {
              pendingShow = false
              setIsVisible(true)
            }
            return () => {
              setVisibleFn = null
            }
          }, [])

          return <App isVisible={isVisible} onClose={() => setIsVisible(false)} />
        }

        root.render(<SpotlightWrapper />)
        return root
      },
      onRemove(root) {
        root?.unmount()
      },
    })

    ui.mount()

    // Watch config changes
    const unwatchConfig = storage.watch<Config>('local:config', (newConfig) => {
      const enabled = newConfig?.spotlight?.enabled ?? true
      if (!enabled) {
        log.info('Spotlight disabled via settings')
        ui.remove()
      }
    })

    ctx.onInvalidated(() => {
      unwatchConfig()
      browser.runtime.onMessage.removeListener(handleMessage)
      ui.remove()
    })
  },
})
