import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/sandbox'
import { handleContextMenuClick, handleContextMenuShown, registerContextMenus } from './contextMenu'
import { connectDevReloadServer } from './devReload'
import {
  handleCapturedResponse,
  handleGetAllTags,
  handleGetConversations,
  handleGetMessages,
  handleGetStats,
  handleSearch,
  handleToggleFavorite,
  handleUpdateTags,
} from './handlers'
import {
  connectCloudProvider,
  disconnectCloudProvider,
  initializeCloudSync,
  isCloudConnected,
  loadCloudSyncState,
  saveCloudSyncState,
  syncToCloud,
} from '@/utils/sync/cloud-sync'
import type { CloudProviderType } from '@/utils/sync/providers/cloud-types'
import { createLogger, getErrorMessage } from '@/utils/logger'

const log = createLogger('ChatCentral')

export default defineBackground({
  type: 'module',

  main() {
    log.info('Background service worker started')

    registerContextMenus()
    const menus = browser.contextMenus
    safeAddListener(menus?.onClicked, handleContextMenuClick)
    safeAddListener(menus?.onShown, handleContextMenuShown)

    // Handle messages from content script
    safeAddListener(
      browser.runtime?.onMessage,
      (message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
        handleMessage(message)
          .then(sendResponse)
          .catch((e: unknown) => {
            log.error('Message handler error:', e)
            sendResponse({ error: getErrorMessage(e) })
          })
        return true // Keep message channel open to support asynchronous response
      }
    )

    // Handle extension install/update
    safeAddListener(
      browser.runtime?.onInstalled,
      (details: { reason: string; previousVersion?: string }) => {
        if (details.reason === 'install') {
          log.info('Extension installed')
        } else if (details.reason === 'update') {
          log.info('Extension updated')
        }

        registerContextMenus()
      }
    )

    // Dev reload: Connect to local WebSocket server for auto-reload
    connectDevReloadServer()

    // Initialize cloud sync
    initializeCloudSync().catch((e) => {
      log.warn('Failed to initialize cloud sync:', e)
    })

    // Set up auto-sync alarm
    setupAutoSyncAlarm()

    // Handle alarm events
    safeAddListener(browser.alarms?.onAlarm, handleAlarm)
  },
})

// ============================================================================
// Auto-Sync Support
// ============================================================================

const AUTO_SYNC_ALARM_NAME = 'cloud-auto-sync'

async function setupAutoSyncAlarm() {
  try {
    const state = await loadCloudSyncState()

    // Clear existing alarm first
    await browser.alarms?.clear(AUTO_SYNC_ALARM_NAME)

    if (state.isConnected && state.autoSyncEnabled) {
      // Create new alarm
      await browser.alarms?.create(AUTO_SYNC_ALARM_NAME, {
        periodInMinutes: state.autoSyncIntervalMinutes,
      })
      log.info(`Auto-sync alarm set for every ${state.autoSyncIntervalMinutes} minutes`)
    }
  } catch (e) {
    log.error('Failed to setup auto-sync alarm:', e)
  }
}

async function handleAlarm(alarm: { name: string }) {
  if (alarm.name === AUTO_SYNC_ALARM_NAME) {
    log.info('Auto-sync alarm triggered')
    try {
      if (isCloudConnected()) {
        await syncToCloud()
        log.info('Auto-sync completed')
      }
    } catch (e) {
      log.error('Auto-sync failed:', e)
    }
  }
}

interface EventTargetLike {
  // eslint-disable-next-line ts/no-explicit-any
  addListener?: (handler: (...args: any[]) => unknown) => void
}

function safeAddListener(
  target: EventTargetLike | undefined,
  handler: (...args: any[]) => unknown
) {
  if (!target?.addListener) return
  target.addListener(handler)
}

interface MessagePayload {
  action: string
  [key: string]: unknown
}

function isMessagePayload(value: unknown): value is MessagePayload {
  return typeof value === 'object' && value !== null && 'action' in value
}

/**
 * Message handler router
 */
async function handleMessage(message: unknown): Promise<unknown> {
  if (!isMessagePayload(message)) {
    return { error: 'Invalid message format' }
  }

  const { action } = message

  switch (action) {
    case 'CAPTURE_API_RESPONSE':
      return handleCapturedResponse(message)

    case 'GET_CONVERSATIONS':
      return handleGetConversations(message)

    case 'GET_MESSAGES':
      return handleGetMessages(message)

    case 'GET_STATS':
      return handleGetStats()

    case 'SEARCH':
      return handleSearch(message)

    case 'TOGGLE_FAVORITE':
      return handleToggleFavorite(message)

    case 'UPDATE_TAGS':
      return handleUpdateTags(message)

    case 'GET_ALL_TAGS':
      return handleGetAllTags()

    // Cloud Sync Actions
    case 'CLOUD_SYNC_CONNECT':
      return handleCloudConnect(message)

    case 'CLOUD_SYNC_DISCONNECT':
      return handleCloudDisconnect()

    case 'CLOUD_SYNC_NOW':
      return handleCloudSyncNow()

    case 'CLOUD_SYNC_GET_STATE':
      return handleCloudGetState()

    case 'CLOUD_SYNC_UPDATE_SETTINGS':
      return handleCloudUpdateSettings(message)

    default:
      log.warn('Unknown action:', action)
      return { error: 'Unknown action' }
  }
}

// ============================================================================
// Cloud Sync Message Handlers
// ============================================================================

async function handleCloudConnect(message: MessagePayload): Promise<unknown> {
  const provider = message.provider as CloudProviderType
  if (!provider) {
    return { error: 'Provider not specified' }
  }

  try {
    await connectCloudProvider(provider)
    // Reset alarm with new state
    await setupAutoSyncAlarm()
    return { success: true }
  } catch (e) {
    return { error: getErrorMessage(e, 'Connection failed') }
  }
}

async function handleCloudDisconnect(): Promise<unknown> {
  try {
    await disconnectCloudProvider()
    // Clear auto-sync alarm
    await browser.alarms?.clear(AUTO_SYNC_ALARM_NAME)
    return { success: true }
  } catch (e) {
    return { error: getErrorMessage(e, 'Disconnect failed') }
  }
}

async function handleCloudSyncNow(): Promise<unknown> {
  if (!isCloudConnected()) {
    return { error: 'Not connected to cloud' }
  }

  try {
    const result = await syncToCloud()
    return { success: result.success, result }
  } catch (e) {
    return { error: getErrorMessage(e, 'Sync failed') }
  }
}

async function handleCloudGetState(): Promise<unknown> {
  const state = await loadCloudSyncState()
  return { state }
}

async function handleCloudUpdateSettings(message: MessagePayload): Promise<unknown> {
  const { autoSyncEnabled, autoSyncIntervalMinutes } = message as {
    autoSyncEnabled?: boolean
    autoSyncIntervalMinutes?: number
  }

  try {
    if (autoSyncEnabled !== undefined || autoSyncIntervalMinutes !== undefined) {
      const state = await loadCloudSyncState()
      await saveCloudSyncState({
        ...state,
        autoSyncEnabled: autoSyncEnabled ?? state.autoSyncEnabled,
        autoSyncIntervalMinutes: autoSyncIntervalMinutes ?? state.autoSyncIntervalMinutes,
      })
      // Reset alarm with new settings
      await setupAutoSyncAlarm()
    }
    return { success: true }
  } catch (e) {
    return { error: getErrorMessage(e, 'Failed to update settings') }
  }
}
