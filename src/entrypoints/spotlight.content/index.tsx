import { useState } from 'react'
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

    let toggleCallback: (() => void) | null = null

    const ui = await createShadowRootUi(ctx, {
      name: 'chat-central-spotlight',
      position: 'overlay',
      zIndex: 2147483646,
      onMount(container, shadow) {
        // Inject styles into shadow root
        const styleEl = document.createElement('style')
        styleEl.textContent = styles
        shadow.appendChild(styleEl)

        // Apply dark mode to shadow host
        applyThemeToHost(shadow.host as HTMLElement)

        const root = ReactDOM.createRoot(container)

        // Wrapper component to manage visibility state
        // Starts hidden — only shown when toggled via TOGGLE_SPOTLIGHT message
        function SpotlightWrapper() {
          const [isVisible, setIsVisible] = useState(false)

          // Expose toggle callback
          toggleCallback = () => setIsVisible((prev) => !prev)

          return <App isVisible={isVisible} onClose={() => setIsVisible(false)} />
        }

        root.render(<SpotlightWrapper />)
        return root
      },
      onRemove(root) {
        toggleCallback = null
        root?.unmount()
      },
    })

    ui.mount()

    // Listen for TOGGLE_SPOTLIGHT messages from background
    const handleMessage = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'action' in message &&
        (message as { action: string }).action === 'TOGGLE_SPOTLIGHT'
      ) {
        if (toggleCallback) {
          toggleCallback()
        }
      }
    }

    browser.runtime.onMessage.addListener(handleMessage)

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
