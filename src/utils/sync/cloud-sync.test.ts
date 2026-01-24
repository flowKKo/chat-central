import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudStorageProvider, CloudSyncState } from './providers/cloud-types'
import { DEFAULT_CLOUD_SYNC_STATE } from './providers/cloud-types'

// Import after mocks are set up
import {
  connectCloudProvider,
  disconnectCloudProvider,
  getActiveProvider,
  isCloudConnected,
  isOnline,
  loadCloudSyncState,
  saveCloudSyncState,
  syncToCloud,
  updateAutoSyncSettings,
} from './cloud-sync'
import { createGoogleDriveProvider } from './providers/google-drive'

// Mock browser API
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
}

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: (...args: unknown[]) => mockStorage.local.get(...args),
        set: (...args: unknown[]) => mockStorage.local.set(...args),
      },
    },
  },
}))

// Mock DB functions
vi.mock('@/utils/db', () => ({
  getAllConversationsForExport: vi.fn().mockResolvedValue([]),
  getAllMessagesForExport: vi.fn().mockResolvedValue([]),
  getSyncState: vi.fn().mockResolvedValue({ deviceId: 'test-device-id' }),
  initializeSyncState: vi.fn().mockResolvedValue({ deviceId: 'test-device-id' }),
}))

// Mock import function
vi.mock('./import', () => ({
  importFromJson: vi.fn().mockResolvedValue({
    success: true,
    imported: { conversations: 0, messages: 0 },
    errors: [],
  }),
}))

// Mock Google Drive provider - this will be configured per test
const mockProvider: CloudStorageProvider = {
  name: 'Google Drive',
  type: 'google-drive',
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(true),
  upload: vi.fn().mockResolvedValue(undefined),
  download: vi.fn().mockResolvedValue(null),
  getLastModified: vi.fn().mockResolvedValue(null),
}

vi.mock('./providers/google-drive', () => ({
  createGoogleDriveProvider: vi.fn(() => mockProvider),
}))

describe('cloud-sync', () => {
  // Store original navigator.onLine descriptor
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine')

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.local.get.mockResolvedValue({})
    mockStorage.local.set.mockResolvedValue(undefined)
    // Reset mock provider functions
    vi.mocked(mockProvider.connect).mockResolvedValue(undefined)
    vi.mocked(mockProvider.disconnect).mockResolvedValue(undefined)
    vi.mocked(mockProvider.isConnected).mockReturnValue(true)
    vi.mocked(mockProvider.upload).mockResolvedValue(undefined)
    vi.mocked(mockProvider.download).mockResolvedValue(null)
    vi.mocked(mockProvider.getLastModified).mockResolvedValue(null)
    // Mock navigator.onLine to be true by default
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  afterEach(async () => {
    // Clean up active provider between tests
    await disconnectCloudProvider()
    // Restore original navigator.onLine
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine)
    }
  })

  describe('loadCloudSyncState', () => {
    it('should return default state when storage is empty', async () => {
      mockStorage.local.get.mockResolvedValue({})

      const state = await loadCloudSyncState()

      expect(state).toEqual(DEFAULT_CLOUD_SYNC_STATE)
    })

    it('should return stored state when available', async () => {
      const storedState: CloudSyncState = {
        provider: 'google-drive',
        isConnected: true,
        lastSyncAt: 1234567890,
        autoSyncEnabled: true,
        autoSyncIntervalMinutes: 10,
        error: null,
      }
      mockStorage.local.get.mockResolvedValue({ cloudSyncState: storedState })

      const state = await loadCloudSyncState()

      expect(state).toEqual(storedState)
    })

    it('should return default state on storage error', async () => {
      mockStorage.local.get.mockRejectedValue(new Error('Storage error'))

      const state = await loadCloudSyncState()

      expect(state).toEqual(DEFAULT_CLOUD_SYNC_STATE)
    })
  })

  describe('saveCloudSyncState', () => {
    it('should save state to storage', async () => {
      const state: CloudSyncState = {
        provider: 'google-drive',
        isConnected: true,
        lastSyncAt: Date.now(),
        autoSyncEnabled: false,
        autoSyncIntervalMinutes: 5,
        error: null,
      }

      await saveCloudSyncState(state)

      expect(mockStorage.local.set).toHaveBeenCalledWith({ cloudSyncState: state })
    })

    it('should not throw on storage error', async () => {
      mockStorage.local.set.mockRejectedValue(new Error('Storage error'))

      // Should not throw
      await expect(saveCloudSyncState(DEFAULT_CLOUD_SYNC_STATE)).resolves.not.toThrow()
    })
  })

  describe('updateAutoSyncSettings', () => {
    it('should update auto-sync enabled state', async () => {
      mockStorage.local.get.mockResolvedValue({ cloudSyncState: DEFAULT_CLOUD_SYNC_STATE })

      await updateAutoSyncSettings(true)

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        cloudSyncState: {
          ...DEFAULT_CLOUD_SYNC_STATE,
          autoSyncEnabled: true,
        },
      })
    })

    it('should update auto-sync interval', async () => {
      mockStorage.local.get.mockResolvedValue({ cloudSyncState: DEFAULT_CLOUD_SYNC_STATE })

      await updateAutoSyncSettings(true, 15)

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        cloudSyncState: {
          ...DEFAULT_CLOUD_SYNC_STATE,
          autoSyncEnabled: true,
          autoSyncIntervalMinutes: 15,
        },
      })
    })
  })

  describe('isOnline', () => {
    it('should return navigator.onLine when available', () => {
      // In jsdom, navigator.onLine is typically true
      expect(typeof isOnline()).toBe('boolean')
    })
  })

  describe('getActiveProvider', () => {
    it('should return null when no provider is connected', () => {
      expect(getActiveProvider()).toBeNull()
    })
  })

  describe('isCloudConnected', () => {
    it('should return false when no provider is connected', () => {
      expect(isCloudConnected()).toBe(false)
    })
  })

  describe('syncToCloud', () => {
    it('should return error when not connected to provider', async () => {
      const result = await syncToCloud()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not connected to cloud provider')
    })

    it('should return error when offline', async () => {
      // Mock navigator.onLine to be false
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const result = await syncToCloud()

      expect(result.success).toBe(false)
      expect(result.error).toContain('No internet connection')
    })
  })

  describe('provider lifecycle', () => {
    it('should create and connect Google Drive provider', async () => {
      await connectCloudProvider('google-drive')

      expect(createGoogleDriveProvider).toHaveBeenCalled()
      expect(mockProvider.connect).toHaveBeenCalled()
      expect(mockStorage.local.set).toHaveBeenCalled()
    })

    it('should throw error for WebDAV provider (not implemented)', async () => {
      await expect(connectCloudProvider('webdav')).rejects.toThrow(
        'WebDAV provider not implemented'
      )
    })

    it('should disconnect and clear state', async () => {
      await connectCloudProvider('google-drive')
      await disconnectCloudProvider()

      expect(mockProvider.disconnect).toHaveBeenCalled()
      expect(mockStorage.local.set).toHaveBeenLastCalledWith({
        cloudSyncState: DEFAULT_CLOUD_SYNC_STATE,
      })
    })
  })

  describe('syncToCloud with active provider', () => {
    beforeEach(async () => {
      await connectCloudProvider('google-drive')
    })

    it('should upload data when cloud has no file', async () => {
      vi.mocked(mockProvider.getLastModified).mockResolvedValue(null)

      const result = await syncToCloud()

      expect(result.success).toBe(true)
      expect(mockProvider.upload).toHaveBeenCalled()
    })

    it('should upload data when local is newer', async () => {
      const oldTime = Date.now() - 10000
      mockStorage.local.get.mockResolvedValue({
        cloudSyncState: {
          ...DEFAULT_CLOUD_SYNC_STATE,
          lastSyncAt: Date.now(),
        },
      })
      vi.mocked(mockProvider.getLastModified).mockResolvedValue(oldTime)

      const result = await syncToCloud()

      expect(result.success).toBe(true)
      expect(mockProvider.download).not.toHaveBeenCalled()
      expect(mockProvider.upload).toHaveBeenCalled()
    })

    it('should download and merge when cloud is newer', async () => {
      const futureTime = Date.now() + 10000
      mockStorage.local.get.mockResolvedValue({
        cloudSyncState: {
          ...DEFAULT_CLOUD_SYNC_STATE,
          lastSyncAt: Date.now() - 20000,
        },
      })
      vi.mocked(mockProvider.getLastModified).mockResolvedValue(futureTime)
      vi.mocked(mockProvider.download).mockResolvedValue(
        JSON.stringify({
          version: '1.0',
          exportedAt: new Date().toISOString(),
          deviceId: 'other-device',
          conversations: [],
        })
      )

      const result = await syncToCloud()

      expect(result.success).toBe(true)
      expect(mockProvider.download).toHaveBeenCalled()
      expect(mockProvider.upload).toHaveBeenCalled()
    })

    it('should handle upload errors with proper error categorization', async () => {
      vi.mocked(mockProvider.upload).mockRejectedValue(new Error('network error'))

      const result = await syncToCloud()

      expect(result.success).toBe(false)
      expect(result.errorCategory).toBe('network')
      expect(result.userMessage).toContain('internet')
    })

    it('should handle auth errors', async () => {
      vi.mocked(mockProvider.upload).mockRejectedValue(new Error('401 unauthorized'))

      const result = await syncToCloud()

      expect(result.success).toBe(false)
      expect(result.errorCategory).toBe('auth')
      expect(result.userMessage).toContain('reconnect')
    })
  })
})
