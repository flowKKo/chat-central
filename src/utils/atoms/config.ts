import { deepmerge } from 'deepmerge-ts'
import { atom } from 'jotai'
import { storage } from 'wxt/storage'
import { type Config, configSchema, DEFAULT_CONFIG } from '@/types'

const CONFIG_STORAGE_KEY = 'config'

/**
 * Config Atom
 * Uses optimistic updates + persistence
 */
export const configAtom = atom<Config>(DEFAULT_CONFIG)

// Write version number, used to prevent old writes from overwriting new values
let writeVersion = 0

/**
 * Write Config Atom
 * Implements optimistic updates and serialized writing
 */
export const writeConfigAtom = atom(null, async (get, set, patch: Partial<Config>) => {
  const currentConfig = get(configAtom)
  const currentVersion = ++writeVersion

  // 1. Optimistic update UI
  const optimisticNext = deepmerge(currentConfig, patch) as Config
  set(configAtom, optimisticNext)

  // 2. Validate and persist
  try {
    const parsed = configSchema.safeParse(optimisticNext)
    if (!parsed.success) {
      console.error('[ChatCentral] Config validation failed:', parsed.error)
      return
    }

    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, parsed.data)
  } catch (e) {
    console.error('[ChatCentral] Failed to save config:', e)
    // If save fails and version is still the current version, rollback
    if (writeVersion === currentVersion) {
      set(configAtom, currentConfig)
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
    console.error('[ChatCentral] Failed to load config:', e)
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
