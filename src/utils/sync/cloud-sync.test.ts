import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { isOnline, loadCloudSyncState, saveCloudSyncState } from './cloud-sync'
import { DEFAULT_CLOUD_SYNC_STATE } from './providers/cloud-types'

// Mock browser.storage.local
const mockStorage = new Map<string, unknown>()
vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (key: string) => {
          const value = mockStorage.get(key)
          return { [key]: value }
        }),
        set: vi.fn(async (data: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(data)) {
            mockStorage.set(key, value)
          }
        }),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
    },
  },
}))

describe('cloud-sync', () => {
  beforeEach(() => {
    mockStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isOnline', () => {
    it('should return true when navigator.onLine is true', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
      })
      expect(isOnline()).toBe(true)
    })

    it('should return false when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      })
      expect(isOnline()).toBe(false)
    })
  })

  describe('loadCloudSyncState', () => {
    it('should return default state when no state is stored', async () => {
      const state = await loadCloudSyncState()
      expect(state).toEqual(DEFAULT_CLOUD_SYNC_STATE)
    })

    it('should return stored state when available', async () => {
      const customState = {
        ...DEFAULT_CLOUD_SYNC_STATE,
        provider: 'google-drive' as const,
        isConnected: true,
        lastSyncAt: 1234567890,
      }
      mockStorage.set('cloudSyncState', customState)

      const state = await loadCloudSyncState()
      expect(state).toEqual(customState)
    })
  })

  describe('saveCloudSyncState', () => {
    it('should save state to storage', async () => {
      const customState = {
        ...DEFAULT_CLOUD_SYNC_STATE,
        provider: 'google-drive' as const,
        isConnected: true,
      }

      await saveCloudSyncState(customState)

      const stored = mockStorage.get('cloudSyncState')
      expect(stored).toEqual(customState)
    })
  })
})

describe('cloudSyncState types', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_CLOUD_SYNC_STATE).toEqual({
      provider: null,
      isConnected: false,
      lastSyncAt: null,
      autoSyncEnabled: false,
      autoSyncIntervalMinutes: 5,
      error: null,
    })
  })
})
