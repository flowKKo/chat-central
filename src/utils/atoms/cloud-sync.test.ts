import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import {
  cloudProviderAtom,
  isCloudConnectedAtom,
  cloudSyncStatusAtom,
  lastCloudSyncAtom,
  autoSyncEnabledAtom,
  autoSyncIntervalAtom,
  cloudSyncErrorAtom,
  lastSyncResultAtom,
  lastSyncTimeAgoAtom,
  isSyncingAtom,
  initializeCloudSyncAtom,
  performSyncAtom,
  connectCloudAtom,
  disconnectCloudAtom,
  toggleAutoSyncAtom,
  setAutoSyncIntervalAtom,
} from './cloud-sync'
import type { CloudSyncResult } from '@/utils/sync/providers/cloud-types'

// Mock dependencies
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('@/utils/sync/cloud-sync', () => ({
  loadCloudSyncState: vi.fn().mockResolvedValue({
    provider: null,
    isConnected: false,
    lastSyncAt: null,
    autoSyncEnabled: false,
    autoSyncIntervalMinutes: 5,
    error: null,
  }),
  connectCloudProvider: vi.fn().mockResolvedValue(undefined),
  disconnectCloudProvider: vi.fn().mockResolvedValue(undefined),
  syncToCloud: vi.fn().mockResolvedValue({
    success: true,
    direction: 'merge',
    stats: { conversationsUploaded: 0, conversationsDownloaded: 0, messagesUploaded: 0, messagesDownloaded: 0 },
  }),
}))

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  getErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}))

const { browser } = await vi.importMock<typeof import('wxt/browser')>('wxt/browser')
const { loadCloudSyncState, connectCloudProvider, disconnectCloudProvider, syncToCloud } =
  await vi.importMock<typeof import('@/utils/sync/cloud-sync')>('@/utils/sync/cloud-sync')

describe('cloud-sync atoms', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    vi.clearAllMocks()
  })

  describe('base atoms', () => {
    it('should have correct default values', () => {
      expect(store.get(cloudProviderAtom)).toBeNull()
      expect(store.get(isCloudConnectedAtom)).toBe(false)
      expect(store.get(cloudSyncStatusAtom)).toBe('idle')
      expect(store.get(lastCloudSyncAtom)).toBeNull()
      expect(store.get(autoSyncEnabledAtom)).toBe(false)
      expect(store.get(autoSyncIntervalAtom)).toBe(5)
      expect(store.get(cloudSyncErrorAtom)).toBeNull()
      expect(store.get(lastSyncResultAtom)).toBeNull()
    })
  })

  describe('lastSyncTimeAgoAtom', () => {
    it('should return null when no last sync', () => {
      expect(store.get(lastSyncTimeAgoAtom)).toBeNull()
    })

    it('should return "Just now" for recent sync', () => {
      store.set(lastCloudSyncAtom, Date.now() - 10_000) // 10 seconds ago
      expect(store.get(lastSyncTimeAgoAtom)).toBe('Just now')
    })

    it('should return "1 minute ago" for 1 minute', () => {
      store.set(lastCloudSyncAtom, Date.now() - 60_000)
      expect(store.get(lastSyncTimeAgoAtom)).toBe('1 minute ago')
    })

    it('should return "5 minutes ago" for 5 minutes', () => {
      store.set(lastCloudSyncAtom, Date.now() - 5 * 60_000)
      expect(store.get(lastSyncTimeAgoAtom)).toBe('5 minutes ago')
    })

    it('should return "1 hour ago" for 1 hour', () => {
      store.set(lastCloudSyncAtom, Date.now() - 60 * 60_000)
      expect(store.get(lastSyncTimeAgoAtom)).toBe('1 hour ago')
    })

    it('should return "2 hours ago" for 2 hours', () => {
      store.set(lastCloudSyncAtom, Date.now() - 2 * 60 * 60_000)
      expect(store.get(lastSyncTimeAgoAtom)).toBe('2 hours ago')
    })

    it('should return "1 day ago" for 1 day', () => {
      store.set(lastCloudSyncAtom, Date.now() - 24 * 60 * 60_000)
      expect(store.get(lastSyncTimeAgoAtom)).toBe('1 day ago')
    })

    it('should return "3 days ago" for 3 days', () => {
      store.set(lastCloudSyncAtom, Date.now() - 3 * 24 * 60 * 60_000)
      expect(store.get(lastSyncTimeAgoAtom)).toBe('3 days ago')
    })
  })

  describe('isSyncingAtom', () => {
    it('should return false when idle', () => {
      expect(store.get(isSyncingAtom)).toBe(false)
    })

    it('should return true when syncing', () => {
      store.set(cloudSyncStatusAtom, 'syncing')
      expect(store.get(isSyncingAtom)).toBe(true)
    })

    it('should return false when in error state', () => {
      store.set(cloudSyncStatusAtom, 'error')
      expect(store.get(isSyncingAtom)).toBe(false)
    })
  })

  describe('initializeCloudSyncAtom', () => {
    it('should load state from storage', async () => {
      loadCloudSyncState.mockResolvedValue({
        provider: 'google-drive',
        isConnected: true,
        lastSyncAt: 5000,
        autoSyncEnabled: true,
        autoSyncIntervalMinutes: 10,
        error: null,
      })

      await store.set(initializeCloudSyncAtom)

      expect(store.get(cloudProviderAtom)).toBe('google-drive')
      expect(store.get(isCloudConnectedAtom)).toBe(true)
      expect(store.get(lastCloudSyncAtom)).toBe(5000)
      expect(store.get(autoSyncEnabledAtom)).toBe(true)
      expect(store.get(autoSyncIntervalAtom)).toBe(10)
    })

    it('should handle errors gracefully', async () => {
      loadCloudSyncState.mockRejectedValue(new Error('storage error'))

      // Should not throw
      await expect(store.set(initializeCloudSyncAtom)).resolves.not.toThrow()
    })
  })

  describe('performSyncAtom', () => {
    it('should not sync when not connected', async () => {
      store.set(isCloudConnectedAtom, false)

      await store.set(performSyncAtom)

      expect(syncToCloud).not.toHaveBeenCalled()
    })

    it('should not sync when already syncing', async () => {
      store.set(isCloudConnectedAtom, true)
      store.set(cloudSyncStatusAtom, 'syncing')

      await store.set(performSyncAtom)

      expect(syncToCloud).not.toHaveBeenCalled()
    })

    it('should set syncing status during sync', async () => {
      store.set(isCloudConnectedAtom, true)
      store.set(cloudSyncStatusAtom, 'idle')

      const successResult: CloudSyncResult = {
        success: true,
        direction: 'merge',
        stats: { conversationsUploaded: 5, conversationsDownloaded: 3, messagesUploaded: 0, messagesDownloaded: 0 },
      }
      syncToCloud.mockResolvedValue(successResult)

      await store.set(performSyncAtom)

      expect(store.get(lastSyncResultAtom)).toEqual(successResult)
      expect(store.get(cloudSyncStatusAtom)).toBe('success')
    })

    it('should set error state on sync failure', async () => {
      store.set(isCloudConnectedAtom, true)
      store.set(cloudSyncStatusAtom, 'idle')

      syncToCloud.mockResolvedValue({
        success: false,
        direction: 'merge',
        error: 'Upload failed',
        stats: { conversationsUploaded: 0, conversationsDownloaded: 0, messagesUploaded: 0, messagesDownloaded: 0 },
      })

      await store.set(performSyncAtom)

      expect(store.get(cloudSyncStatusAtom)).toBe('error')
      expect(store.get(cloudSyncErrorAtom)).toBe('Upload failed')
    })

    it('should handle thrown errors', async () => {
      store.set(isCloudConnectedAtom, true)
      store.set(cloudSyncStatusAtom, 'idle')

      syncToCloud.mockRejectedValue(new Error('Network error'))

      await store.set(performSyncAtom)

      expect(store.get(cloudSyncStatusAtom)).toBe('error')
      expect(store.get(cloudSyncErrorAtom)).toBe('Network error')
    })
  })

  describe('connectCloudAtom', () => {
    it('should connect and set state', async () => {
      syncToCloud.mockResolvedValue({
        success: true,
        direction: 'merge',
        stats: { conversationsUploaded: 0, conversationsDownloaded: 0, messagesUploaded: 0, messagesDownloaded: 0 },
      })

      await store.set(connectCloudAtom, 'google-drive')

      expect(connectCloudProvider).toHaveBeenCalledWith('google-drive')
      expect(store.get(cloudProviderAtom)).toBe('google-drive')
      expect(store.get(isCloudConnectedAtom)).toBe(true)
    })

    it('should set error state on connection failure', async () => {
      connectCloudProvider.mockRejectedValue(new Error('Auth failed'))

      await expect(store.set(connectCloudAtom, 'google-drive')).rejects.toThrow('Auth failed')

      expect(store.get(cloudSyncStatusAtom)).toBe('error')
      expect(store.get(cloudSyncErrorAtom)).toBe('Auth failed')
    })
  })

  describe('disconnectCloudAtom', () => {
    it('should disconnect and reset all state', async () => {
      // Set up connected state
      store.set(cloudProviderAtom, 'google-drive')
      store.set(isCloudConnectedAtom, true)
      store.set(lastCloudSyncAtom, 5000)
      store.set(autoSyncEnabledAtom, true)

      await store.set(disconnectCloudAtom)

      expect(disconnectCloudProvider).toHaveBeenCalled()
      expect(store.get(cloudProviderAtom)).toBeNull()
      expect(store.get(isCloudConnectedAtom)).toBe(false)
      expect(store.get(lastCloudSyncAtom)).toBeNull()
      expect(store.get(autoSyncEnabledAtom)).toBe(false)
      expect(store.get(cloudSyncErrorAtom)).toBeNull()
      expect(store.get(cloudSyncStatusAtom)).toBe('idle')
      expect(store.get(lastSyncResultAtom)).toBeNull()
    })
  })

  describe('toggleAutoSyncAtom', () => {
    it('should toggle auto-sync on', async () => {
      store.set(autoSyncEnabledAtom, false)

      await store.set(toggleAutoSyncAtom)

      expect(store.get(autoSyncEnabledAtom)).toBe(true)
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CLOUD_SYNC_UPDATE_SETTINGS',
          autoSyncEnabled: true,
        }),
      )
    })

    it('should toggle auto-sync off', async () => {
      store.set(autoSyncEnabledAtom, true)

      await store.set(toggleAutoSyncAtom)

      expect(store.get(autoSyncEnabledAtom)).toBe(false)
    })

    it('should accept explicit value', async () => {
      store.set(autoSyncEnabledAtom, false)

      await store.set(toggleAutoSyncAtom, true)

      expect(store.get(autoSyncEnabledAtom)).toBe(true)
    })
  })

  describe('setAutoSyncIntervalAtom', () => {
    it('should update interval and notify background', async () => {
      await store.set(setAutoSyncIntervalAtom, 15)

      expect(store.get(autoSyncIntervalAtom)).toBe(15)
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CLOUD_SYNC_UPDATE_SETTINGS',
          autoSyncIntervalMinutes: 15,
        }),
      )
    })
  })
})
