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
 * Shared toggle signal between message listener and React.
 * The listener fires immediately (before React renders), so we queue
 * toggle requests and let React pick them up via a subscription.
 */
let toggleVersion = 0
const toggleListeners = new Set<() => void>()

function emitToggle() {
  toggleVersion++
  for (const fn of toggleListeners) fn()
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

    // Check if spotlight is enabled
    const config = await storage.getItem<Config>('local:config')
    if (config?.spotlight?.enabled === false) {
      log.debug('Spotlight disabled by config')
      return
    }

    initLanguage()
    log.info('Mounting Spotlight')

    // Listen for TOGGLE_SPOTLIGHT messages BEFORE mounting UI
    // so the first keypress is never missed.
    const handleMessage = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'action' in message &&
        (message as { action: string }).action === 'TOGGLE_SPOTLIGHT'
      ) {
        emitToggle()
      }
    }
    browser.runtime.onMessage.addListener(handleMessage)

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

          // Subscribe to toggle signals from the message listener
          useEffect(() => {
            // Capture the version at mount time so we can detect
            // toggles that arrived before React rendered.
            let lastSeen = toggleVersion
            const check = () => {
              if (toggleVersion !== lastSeen) {
                lastSeen = toggleVersion
                setIsVisible((prev) => !prev)
              }
            }
            // Check immediately in case a toggle arrived before mount
            check()
            toggleListeners.add(check)
            return () => {
              toggleListeners.delete(check)
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
