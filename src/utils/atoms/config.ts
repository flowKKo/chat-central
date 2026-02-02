import { deepmerge } from 'deepmerge-ts'
import { atom } from 'jotai'
import { storage } from 'wxt/storage'
import { type Config, configSchema, DEFAULT_CONFIG } from '@/types'
import { createLogger } from '@/utils/logger'

const log = createLogger('ChatCentral')

const CONFIG_STORAGE_KEY = 'config'

/**
 * Config Atom (internal)
 */
const baseConfigAtom = atom<Config>(DEFAULT_CONFIG)

let hydrated = false

/**
 * Config Atom
 * Self-hydrating: loads from storage on first read and watches for external changes.
 */
export const configAtom = atom(
  (get) => get(baseConfigAtom),
  (_get, set, value: Config) => set(baseConfigAtom, value)
)

/**
 * Hydrate config from storage and watch for external changes.
 * Safe to call multiple times — only runs once.
 */
export function hydrateConfig(set: (config: Config) => void): () => void {
  if (hydrated) return () => {}
  hydrated = true

  // Load initial value
  loadConfig().then(set)

  // Watch for changes from other contexts (widget, popup, etc.)
  return watchConfig(set)
}

// Write version number, used to prevent old writes from overwriting new values
let writeVersion = 0

/**
 * Write Config Atom
 * Implements optimistic updates and serialized writing
 */
export const writeConfigAtom = atom(null, async (get, set, patch: Partial<Config>) => {
  const currentConfig = get(baseConfigAtom)
  const currentVersion = ++writeVersion

  // 1. Optimistic update UI
  const optimisticNext = deepmerge(currentConfig, patch) as Config
  set(baseConfigAtom, optimisticNext)

  // 2. Validate and persist
  try {
    const parsed = configSchema.safeParse(optimisticNext)
    if (!parsed.success) {
      log.error('Config validation failed:', parsed.error)
      return
    }

    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, parsed.data)
  } catch (e) {
    log.error('Failed to save config:', e)
    // If save fails and version is still the current version, rollback
    if (writeVersion === currentVersion) {
      set(baseConfigAtom, currentConfig)
    }
  }
})

/**
 * Load config from storage
 */
export async function loadConfig(): Promise<Config> {
  try {
    const stored = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
    if (stored) {
      const parsed = configSchema.safeParse(stored)
      if (parsed.success) {
        return parsed.data
      }
    }
  } catch (e) {
    log.error('Failed to load config:', e)
  }
  return DEFAULT_CONFIG
}

/**
 * Watch config changes (for cross-context synchronization)
 */
export function watchConfig(callback: (config: Config) => void): () => void {
  const unwatch = storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (newValue) => {
    if (newValue) {
      const parsed = configSchema.safeParse(newValue)
      if (parsed.success) {
        callback(parsed.data)
      }
    }
  })
  return unwatch
}
