import ReactDOM from 'react-dom/client'
import { storage } from 'wxt/storage'
import { defineContentScript } from 'wxt/sandbox'
import { createShadowRootUi } from 'wxt/client'
import type { Config, Platform } from '@/types'
import { getPlatformFromHost } from '@/utils/platform-adapters'
import { createLogger } from '@/utils/logger'
import { App } from './App'
import styles from './styles/widget.css?inline'

const log = createLogger('Widget')

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
    const platform = getPlatformFromHost(window.location.hostname)
    if (!platform) return

    // Check if widget is enabled
    const config = await storage.getItem<Config>('local:config')
    if (config?.widget?.enabled === false) {
      log.debug('Widget disabled by config')
      return
    }

    log.info(`Mounting widget for ${platform}`)

    const ui = await createShadowRootUi(ctx, {
      name: 'chat-central-widget',
      position: 'inline',
      append: 'last',
      onMount(container, shadow) {
        // Inject styles into shadow root
        const styleEl = document.createElement('style')
        styleEl.textContent = styles
        shadow.appendChild(styleEl)

        // Apply dark mode to shadow host
        applyThemeToHost(shadow.host as HTMLElement)

        const root = ReactDOM.createRoot(container)
        root.render(<App platform={platform as Platform} onRemove={() => ui.remove()} />)
        return root
      },
      onRemove(root) {
        root?.unmount()
      },
    })

    ui.mount()
    let mounted = true

    // Watch config changes — remove or re-mount widget
    const unwatchConfig = storage.watch<Config>('local:config', (newConfig) => {
      const enabled = newConfig?.widget?.enabled ?? true
      if (!enabled && mounted) {
        log.info('Widget disabled via settings')
        ui.remove()
        mounted = false
      } else if (enabled && !mounted) {
        log.info('Widget re-enabled via settings')
        ui.mount()
        mounted = true
      }
    })

    ctx.onInvalidated(() => {
      unwatchConfig()
      ui.remove()
      mounted = false
    })
  },
})

function applyThemeToHost(host: HTMLElement) {
  // Detect theme from page context
  const isDark =
    document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches

  if (isDark) {
    host.classList.add('dark')
  }

  // Watch for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    host.classList.toggle('dark', e.matches)
  })

  // Watch for page class changes (Claude/ChatGPT toggle dark mode via class)
  const observer = new MutationObserver(() => {
    const dark =
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark')
    host.classList.toggle('dark', dark)
  })

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
}
