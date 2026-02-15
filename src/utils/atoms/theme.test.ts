import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import { DEFAULT_CONFIG } from '@/types'

// Mock wxt/storage
const mockStorage = vi.hoisted(() => ({
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  watch: vi.fn().mockReturnValue(() => {}),
}))
vi.mock('wxt/storage', () => ({ storage: mockStorage }))

// Setup localStorage mock before importing theme module
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key]
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {}
  }),
  get length() {
    return Object.keys(localStorageMock.store).length
  },
  key: vi.fn((_index: number) => null),
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock window.matchMedia (not available in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Import after localStorage is mocked
const {
  themePreferenceAtom,
  resolvedThemeAtom,
  applyThemeToDocument,
  initializeTheme,
  syncThemeToConfig,
} = await import('./theme')

describe('theme atoms', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    localStorageMock.store = {}
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    mockStorage.getItem.mockReset().mockResolvedValue(null)
    mockStorage.setItem.mockReset().mockResolvedValue(undefined)
    document.documentElement.classList.remove('dark')
  })

  describe('themePreferenceAtom', () => {
    it('should default to system', () => {
      expect(store.get(themePreferenceAtom)).toBe('system')
    })

    it('should persist theme preference to localStorage', () => {
      store.set(themePreferenceAtom, 'dark')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('chat-central-theme', 'dark')
    })

    it('should update atom value when set', () => {
      store.set(themePreferenceAtom, 'light')
      expect(store.get(themePreferenceAtom)).toBe('light')
    })
  })

  describe('resolvedThemeAtom', () => {
    it('should resolve light when preference is light', () => {
      store.set(themePreferenceAtom, 'light')
      expect(store.get(resolvedThemeAtom)).toBe('light')
    })

    it('should resolve dark when preference is dark', () => {
      store.set(themePreferenceAtom, 'dark')
      expect(store.get(resolvedThemeAtom)).toBe('dark')
    })

    it('should resolve system preference when set to system', () => {
      store.set(themePreferenceAtom, 'system')
      // In jsdom, matchMedia returns false for dark, so system resolves to light
      expect(store.get(resolvedThemeAtom)).toBe('light')
    })
  })

  describe('applyThemeToDocument', () => {
    it('should add dark class for dark theme', () => {
      applyThemeToDocument('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should remove dark class for light theme', () => {
      document.documentElement.classList.add('dark')
      applyThemeToDocument('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  describe('initializeTheme', () => {
    it('should apply theme from localStorage', () => {
      localStorageMock.store['chat-central-theme'] = 'dark'
      initializeTheme()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should default to system theme when no stored preference', () => {
      initializeTheme()
      // system -> light in jsdom
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should sync theme to config storage on init', () => {
      localStorageMock.store['chat-central-theme'] = 'dark'
      initializeTheme()
      expect(mockStorage.getItem).toHaveBeenCalledWith('local:config')
    })
  })

  describe('syncThemeToConfig', () => {
    it('should write theme to config storage when different from current', async () => {
      mockStorage.getItem.mockResolvedValue(DEFAULT_CONFIG)
      await syncThemeToConfig('dark')
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'local:config',
        expect.objectContaining({ ui: expect.objectContaining({ theme: 'dark' }) })
      )
    })

    it('should skip write when theme is already the same', async () => {
      mockStorage.getItem.mockResolvedValue(DEFAULT_CONFIG) // default theme is 'system'
      await syncThemeToConfig('system')
      expect(mockStorage.setItem).not.toHaveBeenCalled()
    })

    it('should use DEFAULT_CONFIG when no config exists in storage', async () => {
      mockStorage.getItem.mockResolvedValue(null)
      await syncThemeToConfig('light')
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'local:config',
        expect.objectContaining({ ui: expect.objectContaining({ theme: 'light' }) })
      )
    })

    it('should not throw when storage fails', async () => {
      mockStorage.getItem.mockRejectedValue(new Error('storage error'))
      await expect(syncThemeToConfig('dark')).resolves.toBeUndefined()
    })
  })

  describe('themePreferenceAtom config sync', () => {
    it('should sync theme to config storage when preference changes', () => {
      store.set(themePreferenceAtom, 'dark')
      expect(mockStorage.getItem).toHaveBeenCalledWith('local:config')
    })
  })
})
