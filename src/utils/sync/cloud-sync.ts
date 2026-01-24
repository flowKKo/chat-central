import { browser } from 'wxt/browser'
import type { Conversation, Message } from '@/types'
import {
  getAllConversationsForExport,
  getAllMessagesForExport,
  getSyncState,
  initializeSyncState,
} from '@/utils/db'
import { importFromJson } from './import'
import type { CloudStorageProvider, CloudSyncResult, CloudSyncState } from './providers/cloud-types'
import {
  CloudSyncError,
  createEmptyCloudSyncResult,
  DEFAULT_CLOUD_SYNC_STATE,
} from './providers/cloud-types'
import { createGoogleDriveProvider } from './providers/google-drive'
import { syncLogger } from './utils'

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'cloudSyncState'
const SYNC_FILENAME = 'chat-central-sync.json'
const EXPORT_VERSION = '1.0'

// ============================================================================
// Provider Management
// ============================================================================

let activeProvider: CloudStorageProvider | null = null

/**
 * Get the active cloud provider
 */
export function getActiveProvider(): CloudStorageProvider | null {
  return activeProvider
}

/**
 * Connect to a cloud provider
 */
export async function connectCloudProvider(providerType: 'google-drive' | 'webdav'): Promise<void> {
  // Disconnect existing provider if any
  if (activeProvider) {
    await disconnectCloudProvider()
  }

  // Create and connect provider
  switch (providerType) {
    case 'google-drive':
      activeProvider = createGoogleDriveProvider()
      break
    case 'webdav':
      throw new Error('WebDAV provider not implemented yet')
    default:
      throw new Error(`Unknown provider type: ${providerType}`)
  }

  await activeProvider.connect()

  // Save state
  await saveCloudSyncState({
    ...DEFAULT_CLOUD_SYNC_STATE,
    provider: providerType,
    isConnected: true,
  })

  syncLogger.info(`Connected to ${providerType}`)
}

/**
 * Disconnect from cloud provider
 */
export async function disconnectCloudProvider(): Promise<void> {
  if (activeProvider) {
    await activeProvider.disconnect()
    activeProvider = null
  }

  // Clear state
  await saveCloudSyncState(DEFAULT_CLOUD_SYNC_STATE)

  syncLogger.info('Disconnected from cloud provider')
}

/**
 * Check if connected to cloud
 */
export function isCloudConnected(): boolean {
  return activeProvider?.isConnected() ?? false
}

// ============================================================================
// Cloud Sync Operations
// ============================================================================

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Perform full cloud sync
 * 1. Check cloud file modification time
 * 2. If cloud is newer, download and merge first
 * 3. Export local data and upload
 */
export async function syncToCloud(): Promise<CloudSyncResult> {
  // Check network connectivity
  if (!isOnline()) {
    return {
      ...createEmptyCloudSyncResult('upload'),
      success: false,
      error: 'No internet connection. Sync will retry when online.',
    }
  }

  if (!activeProvider) {
    return {
      ...createEmptyCloudSyncResult('upload'),
      success: false,
      error: 'Not connected to cloud provider',
    }
  }

  const result = createEmptyCloudSyncResult('merge')

  try {
    // Step 1: Check if cloud has newer data
    const cloudModified = await activeProvider.getLastModified(SYNC_FILENAME)
    const state = await loadCloudSyncState()
    const lastSync = state.lastSyncAt

    // Step 2: Download and merge if cloud is newer
    if (cloudModified && (!lastSync || cloudModified > lastSync)) {
      syncLogger.info('Cloud has newer data, downloading first...')
      const downloadResult = await downloadAndMerge()
      if (!downloadResult.success) {
        return downloadResult
      }
      result.stats.conversationsDownloaded = downloadResult.stats.conversationsDownloaded
      result.stats.messagesDownloaded = downloadResult.stats.messagesDownloaded
    }

    // Step 3: Export local data
    const exportData = await createExportData()

    // Step 4: Upload to cloud
    await activeProvider.upload(JSON.stringify(exportData, null, 2), SYNC_FILENAME)

    result.stats.conversationsUploaded = exportData.conversations.length
    result.stats.messagesUploaded = exportData.conversations.reduce(
      (sum, c) => sum + (c.messages?.length ?? 0),
      0
    )

    // Update last sync time
    await saveCloudSyncState({
      ...state,
      lastSyncAt: Date.now(),
      error: null,
    })

    syncLogger.info('Cloud sync completed successfully', result.stats)
    return result
  } catch (error) {
    const syncError = CloudSyncError.fromError(error)
    syncLogger.error('Cloud sync failed', syncError)

    // Update state with error
    const state = await loadCloudSyncState()
    await saveCloudSyncState({
      ...state,
      error: syncError.userMessage,
    })

    return {
      ...result,
      success: false,
      error: syncError.message,
      errorCategory: syncError.category,
      userMessage: syncError.userMessage,
    }
  }
}

/**
 * Download data from cloud and merge with local
 */
async function downloadAndMerge(): Promise<CloudSyncResult> {
  const result = createEmptyCloudSyncResult('download')

  if (!activeProvider) {
    return {
      ...result,
      success: false,
      error: 'Not connected to cloud provider',
    }
  }

  try {
    const cloudData = await activeProvider.download(SYNC_FILENAME)

    if (!cloudData) {
      syncLogger.info('No data found in cloud')
      return result
    }

    // Create a temporary file-like object for the import function
    const blob = new Blob([cloudData], { type: 'application/json' })
    const file = new File([blob], 'cloud-sync.json', { type: 'application/json' })

    // Use existing import function with merge strategy
    const importResult = await importFromJson(file, { conflictStrategy: 'merge' })

    result.stats.conversationsDownloaded = importResult.imported.conversations
    result.stats.messagesDownloaded = importResult.imported.messages

    if (!importResult.success) {
      return {
        ...result,
        success: false,
        error: importResult.errors.map((e) => e.message).join(', '),
      }
    }

    return result
  } catch (error) {
    const syncError = CloudSyncError.fromError(error)
    return {
      ...result,
      success: false,
      error: syncError.message,
      errorCategory: syncError.category,
      userMessage: syncError.userMessage,
    }
  }
}

// ============================================================================
// Export Data Structure
// ============================================================================

interface CloudExportData {
  version: string
  exportedAt: string
  deviceId: string
  conversations: Array<Conversation & { messages?: Message[] }>
}

/**
 * Create export data structure
 */
async function createExportData(): Promise<CloudExportData> {
  // Get sync state for device ID
  let syncState = await getSyncState()
  if (!syncState) {
    syncState = await initializeSyncState()
  }

  // Get all conversations and messages
  const conversations = await getAllConversationsForExport({
    includeDeleted: false,
  })

  const conversationIds = conversations.map((c) => c.id)
  const messages = await getAllMessagesForExport(conversationIds, {
    includeDeleted: false,
  })

  // Group messages by conversation
  const messagesByConversation = new Map<string, Message[]>()
  for (const msg of messages) {
    const existing = messagesByConversation.get(msg.conversationId) || []
    existing.push(msg)
    messagesByConversation.set(msg.conversationId, existing)
  }

  // Build export structure
  const data: CloudExportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId: syncState.deviceId,
    conversations: conversations.map((conv) => ({
      ...conv,
      messages: messagesByConversation.get(conv.id) || [],
    })),
  }

  return data
}

// ============================================================================
// State Persistence
// ============================================================================

/**
 * Load cloud sync state from storage
 */
export async function loadCloudSyncState(): Promise<CloudSyncState> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY)
    const state = result[STORAGE_KEY] as CloudSyncState | undefined
    return state ?? DEFAULT_CLOUD_SYNC_STATE
  } catch (error) {
    syncLogger.error('Failed to load cloud sync state', error)
    return DEFAULT_CLOUD_SYNC_STATE
  }
}

/**
 * Save cloud sync state to storage
 */
export async function saveCloudSyncState(state: CloudSyncState): Promise<void> {
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: state })
  } catch (error) {
    syncLogger.error('Failed to save cloud sync state', error)
  }
}

/**
 * Update auto-sync settings
 */
export async function updateAutoSyncSettings(
  enabled: boolean,
  intervalMinutes?: number
): Promise<void> {
  const state = await loadCloudSyncState()
  await saveCloudSyncState({
    ...state,
    autoSyncEnabled: enabled,
    autoSyncIntervalMinutes: intervalMinutes ?? state.autoSyncIntervalMinutes,
  })
}

// ============================================================================
// Initialize on Load
// ============================================================================

/**
 * Restore connection state on extension startup
 */
export async function initializeCloudSync(): Promise<void> {
  const state = await loadCloudSyncState()

  if (state.isConnected && state.provider) {
    try {
      // Try to reconnect
      await connectCloudProvider(state.provider)
      syncLogger.info('Restored cloud connection')
    } catch (error) {
      syncLogger.warn('Failed to restore cloud connection', error)
      // Clear connected state
      await saveCloudSyncState({
        ...state,
        isConnected: false,
        error: 'Failed to restore connection',
      })
    }
  }
}
