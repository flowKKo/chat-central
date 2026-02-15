import { atom } from 'jotai'
import { storage } from 'wxt/storage'
import { type Config, DEFAULT_CONFIG, configSchema } from '@/types'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'chat-central-theme'

// Helper to get system preference
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Helper to resolve theme preference to actual theme
function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme()
  }
  return preference
}

// Helper to get stored preference
function getStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

// Base atom for theme preference (what user selected)
const themePreferenceBaseAtom = atom<ThemePreference>(getStoredPreference())

// Derived atom for resolved theme (actual theme applied)
const resolvedThemeBaseAtom = atom<ResolvedTheme>((get) => {
  const preference = get(themePreferenceBaseAtom)
  return resolveTheme(preference)
})

// Writable atom for theme preference with persistence
export const themePreferenceAtom = atom(
  (get) => get(themePreferenceBaseAtom),
  (_get, set, newPreference: ThemePreference) => {
    set(themePreferenceBaseAtom, newPreference)
    localStorage.setItem(STORAGE_KEY, newPreference)

    // Apply theme to document
    const resolved = resolveTheme(newPreference)
    applyThemeToDocument(resolved)

    // Sync to browser.storage.local config for content scripts
    syncThemeToConfig(newPreference)
  }
)

// Read-only atom for resolved theme
export const resolvedThemeAtom = atom((get) => get(resolvedThemeBaseAtom))

// Helper to apply theme class to document
export function applyThemeToDocument(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// Sync theme preference to browser.storage.local config (for content scripts)
export async function syncThemeToConfig(theme: ThemePreference): Promise<void> {
  try {
    const config = await storage.getItem<Config>('local:config')
    const current = config ?? DEFAULT_CONFIG
    if (current.ui.theme === theme) return
    const updated = { ...current, ui: { ...current.ui, theme } }
    const parsed = configSchema.safeParse(updated)
    if (parsed.success) {
      await storage.setItem('local:config', parsed.data)
    }
  } catch {
    // Best-effort — content script theme sync is non-critical
  }
}

// Initialize theme on load
export function initializeTheme(): void {
  const preference = getStoredPreference()
  const resolved = resolveTheme(preference)
  applyThemeToDocument(resolved)

  // Sync current preference to config storage for content scripts
  syncThemeToConfig(preference)
}

// Setup system preference change listener
export function setupSystemThemeListener(
  onSystemChange: (resolved: ResolvedTheme) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  const handler = (e: MediaQueryListEvent) => {
    const preference = getStoredPreference()
    if (preference === 'system') {
      const newTheme = e.matches ? 'dark' : 'light'
      applyThemeToDocument(newTheme)
      onSystemChange(newTheme)
    }
  }

  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}
