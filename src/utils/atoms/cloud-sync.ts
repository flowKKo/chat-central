import { atom } from 'jotai'
import { browser } from 'wxt/browser'
import type {
  CloudProviderType,
  CloudSyncResult,
  CloudSyncOperationStatus,
} from '@/utils/sync/providers/cloud-types'
import {
  connectCloudProvider,
  disconnectCloudProvider,
  loadCloudSyncState,
  syncToCloud,
} from '@/utils/sync/cloud-sync'

// ============================================================================
// Cloud Sync State Atoms
// ============================================================================

/**
 * Cloud provider type (null if not connected)
 */
export const cloudProviderAtom = atom<CloudProviderType | null>(null)

/**
 * Whether connected to cloud
 */
export const isCloudConnectedAtom = atom(false)

/**
 * Current sync operation status
 */
export const cloudSyncStatusAtom = atom<CloudSyncOperationStatus>('idle')

/**
 * Last cloud sync timestamp
 */
export const lastCloudSyncAtom = atom<number | null>(null)

/**
 * Auto-sync enabled
 */
export const autoSyncEnabledAtom = atom(false)

/**
 * Auto-sync interval in minutes
 */
export const autoSyncIntervalAtom = atom(5)

/**
 * Last sync error message
 */
export const cloudSyncErrorAtom = atom<string | null>(null)

/**
 * Last sync result
 */
export const lastSyncResultAtom = atom<CloudSyncResult | null>(null)

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Human-readable last sync time
 */
export const lastSyncTimeAgoAtom = atom((get) => {
  const lastSync = get(lastCloudSyncAtom)
  if (!lastSync) return null

  const now = Date.now()
  const diff = now - lastSync

  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
})

/**
 * Cloud sync is in progress
 */
export const isSyncingAtom = atom((get) => get(cloudSyncStatusAtom) === 'syncing')

/**
 * Network online status
 */
export const isOnlineAtom = atom(typeof navigator !== 'undefined' ? navigator.onLine : true)

// ============================================================================
// Action Atoms
// ============================================================================

/**
 * Initialize cloud sync state from storage
 */
export const initializeCloudSyncAtom = atom(null, async (_get, set) => {
  try {
    const state = await loadCloudSyncState()
    set(cloudProviderAtom, state.provider)
    set(isCloudConnectedAtom, state.isConnected)
    set(lastCloudSyncAtom, state.lastSyncAt)
    set(autoSyncEnabledAtom, state.autoSyncEnabled)
    set(autoSyncIntervalAtom, state.autoSyncIntervalMinutes)
    set(cloudSyncErrorAtom, state.error)
  } catch (error) {
    console.error('[CloudSync] Failed to initialize:', error)
  }
})

/**
 * Perform sync to cloud
 */
export const performSyncAtom = atom(null, async (get, set) => {
  const isConnected = get(isCloudConnectedAtom)
  if (!isConnected) {
    return
  }

  const isSyncing = get(cloudSyncStatusAtom) === 'syncing'
  if (isSyncing) {
    return // Already syncing
  }

  set(cloudSyncStatusAtom, 'syncing')
  set(cloudSyncErrorAtom, null)

  try {
    const result = await syncToCloud()
    set(lastSyncResultAtom, result)

    if (result.success) {
      set(cloudSyncStatusAtom, 'success')
      set(lastCloudSyncAtom, Date.now())

      // Reset status to idle after a delay
      setTimeout(() => {
        set(cloudSyncStatusAtom, 'idle')
      }, 3000)
    } else {
      set(cloudSyncErrorAtom, result.error ?? 'Sync failed')
      set(cloudSyncStatusAtom, 'error')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    set(cloudSyncErrorAtom, message)
    set(cloudSyncStatusAtom, 'error')
  }
})

/**
 * Connect to cloud provider
 */
export const connectCloudAtom = atom(null, async (_get, set, provider: CloudProviderType) => {
  set(cloudSyncStatusAtom, 'syncing')
  set(cloudSyncErrorAtom, null)

  try {
    await connectCloudProvider(provider)

    set(cloudProviderAtom, provider)
    set(isCloudConnectedAtom, true)
    set(cloudSyncStatusAtom, 'success')

    // Trigger initial sync after connecting
    await set(performSyncAtom)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect'
    set(cloudSyncErrorAtom, message)
    set(cloudSyncStatusAtom, 'error')
    throw error
  }
})

/**
 * Disconnect from cloud provider
 */
export const disconnectCloudAtom = atom(null, async (_get, set) => {
  try {
    await disconnectCloudProvider()

    set(cloudProviderAtom, null)
    set(isCloudConnectedAtom, false)
    set(lastCloudSyncAtom, null)
    set(autoSyncEnabledAtom, false)
    set(cloudSyncErrorAtom, null)
    set(cloudSyncStatusAtom, 'idle')
    set(lastSyncResultAtom, null)
  } catch (error) {
    console.error('[CloudSync] Failed to disconnect:', error)
  }
})

/**
 * Toggle auto-sync
 * Sends message to background script to update alarm
 */
export const toggleAutoSyncAtom = atom(null, async (get, set, enabled?: boolean) => {
  const current = get(autoSyncEnabledAtom)
  const interval = get(autoSyncIntervalAtom)
  const newValue = enabled ?? !current

  set(autoSyncEnabledAtom, newValue)

  // Notify background script to update alarm
  try {
    await browser.runtime.sendMessage({
      action: 'CLOUD_SYNC_UPDATE_SETTINGS',
      autoSyncEnabled: newValue,
      autoSyncIntervalMinutes: interval,
    })
  } catch (error) {
    console.error('[CloudSync] Failed to update auto-sync settings:', error)
  }
})

/**
 * Set auto-sync interval
 * Sends message to background script to update alarm
 */
export const setAutoSyncIntervalAtom = atom(null, async (get, set, minutes: number) => {
  set(autoSyncIntervalAtom, minutes)

  // Notify background script to update alarm
  try {
    await browser.runtime.sendMessage({
      action: 'CLOUD_SYNC_UPDATE_SETTINGS',
      autoSyncEnabled: get(autoSyncEnabledAtom),
      autoSyncIntervalMinutes: minutes,
    })
  } catch (error) {
    console.error('[CloudSync] Failed to update auto-sync interval:', error)
  }
})
