import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { CloudSyncStatus, SyncConflict, ConflictRecord } from '@/utils/sync/types'
import { syncManager, type SyncManagerState } from '@/utils/sync/manager'
import { toSyncConflict } from '@/utils/sync/types'

// ============================================================================
// Storage Keys
// ============================================================================

const SYNC_SETTINGS_KEY = 'chat-central:sync-settings'

// ============================================================================
// Types
// ============================================================================

export interface SyncSettings {
  enabled: boolean
  autoSync: boolean
  autoSyncInterval: number // minutes
  endpoint: string
  apiKey: string
  wifiOnly: boolean
  autoResolveConflicts: boolean
}

export interface SyncUIState {
  status: CloudSyncStatus
  lastSyncAt: number | null
  pendingChanges: number
  pendingConflicts: number
  lastError: string | null
  isOnline: boolean
  isSyncing: boolean
}

// ============================================================================
// Default Values
// ============================================================================

const defaultSyncSettings: SyncSettings = {
  enabled: false,
  autoSync: true,
  autoSyncInterval: 5,
  endpoint: '',
  apiKey: '',
  wifiOnly: false,
  autoResolveConflicts: true,
}

const defaultSyncUIState: SyncUIState = {
  status: 'disabled',
  lastSyncAt: null,
  pendingChanges: 0,
  pendingConflicts: 0,
  lastError: null,
  isOnline: true,
  isSyncing: false,
}

// ============================================================================
// Base Atoms
// ============================================================================

/**
 * Sync settings (persisted to storage)
 */
export const syncSettingsAtom = atomWithStorage<SyncSettings>(
  SYNC_SETTINGS_KEY,
  defaultSyncSettings
)

/**
 * Current sync UI state (not persisted)
 */
export const syncUIStateAtom = atom<SyncUIState>(defaultSyncUIState)

/**
 * List of unresolved conflicts
 */
export const syncConflictsAtom = atom<SyncConflict[]>([])

/**
 * Whether the sync settings modal is open
 */
export const syncSettingsOpenAtom = atom(false)

/**
 * Whether the conflict resolver is open
 */
export const conflictResolverOpenAtom = atom(false)

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Whether sync is enabled and configured
 */
export const isSyncEnabledAtom = atom((get) => {
  const settings = get(syncSettingsAtom)
  return settings.enabled && settings.endpoint.length > 0
})

/**
 * Whether there are pending changes to sync
 */
export const hasPendingChangesAtom = atom((get) => {
  const state = get(syncUIStateAtom)
  return state.pendingChanges > 0
})

/**
 * Whether there are unresolved conflicts
 */
export const hasConflictsAtom = atom((get) => {
  const conflicts = get(syncConflictsAtom)
  return conflicts.length > 0
})

/**
 * Sync status text for display
 */
export const syncStatusTextAtom = atom((get) => {
  const state = get(syncUIStateAtom)
  const settings = get(syncSettingsAtom)

  if (!settings.enabled) {
    return 'Sync disabled'
  }

  if (!state.isOnline) {
    return 'Offline'
  }

  if (state.isSyncing) {
    return 'Syncing...'
  }

  if (state.lastError) {
    return `Error: ${state.lastError}`
  }

  if (state.pendingConflicts > 0) {
    return `${state.pendingConflicts} conflict${state.pendingConflicts > 1 ? 's' : ''}`
  }

  if (state.pendingChanges > 0) {
    return `${state.pendingChanges} pending`
  }

  if (state.lastSyncAt) {
    const ago = Date.now() - state.lastSyncAt
    if (ago < 60000) return 'Just synced'
    if (ago < 3600000) return `Synced ${Math.floor(ago / 60000)}m ago`
    if (ago < 86400000) return `Synced ${Math.floor(ago / 3600000)}h ago`
    return `Synced ${Math.floor(ago / 86400000)}d ago`
  }

  return 'Never synced'
})

// ============================================================================
// Action Atoms
// ============================================================================

/**
 * Trigger a manual sync
 */
export const triggerSyncAtom = atom(null, async (get, set) => {
  const settings = get(syncSettingsAtom)
  if (!settings.enabled) return

  set(syncUIStateAtom, (prev) => ({ ...prev, isSyncing: true }))

  try {
    const result = await syncManager.sync()

    if (result.success) {
      set(syncUIStateAtom, (prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: Date.now(),
        lastError: null,
        pendingChanges: 0,
      }))
    } else {
      set(syncUIStateAtom, (prev) => ({
        ...prev,
        isSyncing: false,
        lastError: result.errors[0]?.message ?? 'Sync failed',
      }))
    }

    // Update conflicts
    if (result.conflicts.length > 0) {
      set(syncConflictsAtom, result.conflicts)
    }

    return result
  } catch (error) {
    set(syncUIStateAtom, (prev) => ({
      ...prev,
      isSyncing: false,
      lastError: error instanceof Error ? error.message : 'Unknown error',
    }))
    throw error
  }
})

/**
 * Initialize sync with current settings
 */
export const initializeSyncAtom = atom(null, async (get, set) => {
  const settings = get(syncSettingsAtom)

  if (!settings.enabled || !settings.endpoint) {
    return
  }

  try {
    await syncManager.initialize({
      type: 'rest',
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
    })

    syncManager.configure({
      autoSyncInterval: settings.autoSyncInterval * 60 * 1000,
      wifiOnly: settings.wifiOnly,
      autoResolveConflicts: settings.autoResolveConflicts,
    })

    if (settings.autoSync) {
      syncManager.startAutoSync()
    }

    // Subscribe to sync events with handler map
    syncManager.subscribe((event, data) => {
      const uiUpdates: Record<string, Partial<SyncUIState>> = {
        status_changed: { status: data as CloudSyncStatus },
        sync_started: { isSyncing: true },
        sync_completed: { isSyncing: false, lastSyncAt: Date.now(), lastError: null },
        sync_failed: {
          isSyncing: false,
          lastError: (data as { message?: string })?.message ?? 'Sync failed',
        },
        online_changed: { isOnline: data as boolean },
      }

      if (event === 'conflict_detected') {
        set(syncConflictsAtom, (data as ConflictRecord[]).map(toSyncConflict))
      } else if (event in uiUpdates) {
        set(syncUIStateAtom, (prev) => ({ ...prev, ...uiUpdates[event] }))
      }
    })

    set(syncUIStateAtom, (prev) => ({ ...prev, status: 'idle' }))
  } catch (error) {
    set(syncUIStateAtom, (prev) => ({
      ...prev,
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Failed to initialize sync',
    }))
  }
})

/**
 * Update sync settings and reinitialize if needed
 */
export const updateSyncSettingsAtom = atom(
  null,
  async (get, set, newSettings: Partial<SyncSettings>) => {
    const currentSettings = get(syncSettingsAtom)
    const updatedSettings = { ...currentSettings, ...newSettings }

    set(syncSettingsAtom, updatedSettings)

    // If sync was enabled/disabled or endpoint changed, reinitialize
    if (
      newSettings.enabled !== undefined ||
      newSettings.endpoint !== undefined ||
      newSettings.apiKey !== undefined
    ) {
      if (updatedSettings.enabled && updatedSettings.endpoint) {
        await set(initializeSyncAtom)
      } else {
        await syncManager.disconnect()
        set(syncUIStateAtom, defaultSyncUIState)
      }
    }

    // Update auto-sync settings
    if (newSettings.autoSync !== undefined || newSettings.autoSyncInterval !== undefined) {
      if (updatedSettings.autoSync && syncManager.isEnabled()) {
        syncManager.startAutoSync(updatedSettings.autoSyncInterval * 60 * 1000)
      } else {
        syncManager.stopAutoSync()
      }
    }
  }
)

/**
 * Refresh sync state from manager
 */
export const refreshSyncStateAtom = atom(null, async (_get, set) => {
  try {
    const state: SyncManagerState = await syncManager.getState()

    set(syncUIStateAtom, {
      status: state.status,
      lastSyncAt: state.lastSyncAt,
      pendingChanges: state.pendingChanges,
      pendingConflicts: state.pendingConflicts,
      lastError: state.lastError,
      isOnline: state.isOnline,
      isSyncing: false,
    })
  } catch {
    // Manager not initialized yet
  }
})
