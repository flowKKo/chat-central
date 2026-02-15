import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_CONFIG, type Config } from '@/types'

// Mock wxt/storage
const mockStorage = vi.hoisted(() => ({
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  watch: vi.fn().mockReturnValue(() => {}),
}))
vi.mock('wxt/storage', () => ({ storage: mockStorage }))

// Mock matchMedia
let mockDarkMode = false
const mockMediaListeners: Array<(e: { matches: boolean }) => void> = []

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? mockDarkMode : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
      mockMediaListeners.push(handler)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const { applyThemeToHost } = await import('./content-script-theme')

function makeConfig(theme: 'light' | 'dark' | 'system'): Config {
  return { ...DEFAULT_CONFIG, ui: { ...DEFAULT_CONFIG.ui, theme } }
}

describe('content-script-theme', () => {
  let host: HTMLElement

  beforeEach(() => {
    host = document.createElement('div')
    mockDarkMode = false
    mockMediaListeners.length = 0
    mockStorage.getItem.mockReset().mockResolvedValue(null)
    mockStorage.watch.mockReset().mockReturnValue(() => {})
  })

  describe('applyThemeToHost', () => {
    it('should add dark class when config theme is dark', async () => {
      mockStorage.getItem.mockResolvedValue(makeConfig('dark'))
      applyThemeToHost(host)
      await vi.waitFor(() => {
        expect(host.classList.contains('dark')).toBe(true)
      })
    })

    it('should not add dark class when config theme is light', async () => {
      mockStorage.getItem.mockResolvedValue(makeConfig('light'))
      applyThemeToHost(host)
      await vi.waitFor(() => {
        expect(host.classList.contains('dark')).toBe(false)
      })
    })

    it('should use system preference when config theme is system and system is dark', async () => {
      mockDarkMode = true
      mockStorage.getItem.mockResolvedValue(makeConfig('system'))
      applyThemeToHost(host)
      await vi.waitFor(() => {
        expect(host.classList.contains('dark')).toBe(true)
      })
    })

    it('should use system preference when config theme is system and system is light', async () => {
      mockDarkMode = false
      mockStorage.getItem.mockResolvedValue(makeConfig('system'))
      applyThemeToHost(host)
      await vi.waitFor(() => {
        expect(host.classList.contains('dark')).toBe(false)
      })
    })

    it('should fall back to system preference when config is null (default)', async () => {
      mockDarkMode = true
      mockStorage.getItem.mockResolvedValue(null)
      applyThemeToHost(host)
      // DEFAULT_CONFIG.ui.theme is 'system', and mockDarkMode is true
      await vi.waitFor(() => {
        expect(host.classList.contains('dark')).toBe(true)
      })
    })

    it('should fall back to system preference on storage error', async () => {
      mockDarkMode = true
      mockStorage.getItem.mockRejectedValue(new Error('storage error'))
      applyThemeToHost(host)
      await vi.waitFor(() => {
        expect(host.classList.contains('dark')).toBe(true)
      })
    })

    it('should watch config for changes', () => {
      applyThemeToHost(host)
      expect(mockStorage.watch).toHaveBeenCalledWith('local:config', expect.any(Function))
    })

    it('should apply theme when config watch fires', async () => {
      let watchCallback: ((config: Config | null) => void) | null = null
      mockStorage.watch.mockImplementation((_key: string, cb: (config: Config | null) => void) => {
        watchCallback = cb
        return () => {}
      })

      mockStorage.getItem.mockResolvedValue(makeConfig('light'))
      applyThemeToHost(host)

      await vi.waitFor(() => {
        expect(host.classList.contains('dark')).toBe(false)
      })

      // Simulate config change to dark
      watchCallback!(makeConfig('dark'))
      expect(host.classList.contains('dark')).toBe(true)
    })

    it('should re-evaluate theme on system theme change when preference is system', async () => {
      mockDarkMode = false
      mockStorage.getItem.mockResolvedValue(makeConfig('system'))
      applyThemeToHost(host)

      await vi.waitFor(() => {
        expect(host.classList.contains('dark')).toBe(false)
      })

      // Simulate system going dark
      mockDarkMode = true
      mockStorage.getItem.mockResolvedValue(makeConfig('system'))

      // Trigger the media query change listener
      expect(mockMediaListeners.length).toBeGreaterThan(0)
      mockMediaListeners[0]!({ matches: true })

      await vi.waitFor(() => {
        expect(host.classList.contains('dark')).toBe(true)
      })
    })
  })
})
