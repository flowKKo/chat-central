/**
 * Shared theme application for content script Shadow DOM hosts.
 * Reads the theme preference from extension config (browser.storage.local)
 * and applies the appropriate dark/light class to the Shadow DOM host.
 */
import { storage } from 'wxt/storage'
import { type Config, DEFAULT_CONFIG } from '@/types'
import { createLogger } from '@/utils/logger'

const log = createLogger('ContentScriptTheme')

type ThemePreference = 'light' | 'dark' | 'system'

function isDark(preference: ThemePreference): boolean {
  if (preference === 'dark') return true
  if (preference === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getThemeFromConfig(config: Config | null): ThemePreference {
  return (config?.ui?.theme ?? DEFAULT_CONFIG.ui.theme) as ThemePreference
}

export function applyThemeToHost(host: HTMLElement): void {
  function apply(config: Config | null): void {
    host.classList.toggle('dark', isDark(getThemeFromConfig(config)))
  }

  // Initial read from extension config
  storage
    .getItem<Config>('local:config')
    .then(apply)
    .catch(() => {
      // Fallback to system preference
      host.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
    })

  // Watch for config changes (user changes theme in settings)
  storage.watch<Config>('local:config', apply)

  // Watch for system theme changes (relevant when preference is 'system')
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    storage
      .getItem<Config>('local:config')
      .then(apply)
      .catch((e: unknown) => log.debug('Failed to read config for theme:', e))
  })
}
