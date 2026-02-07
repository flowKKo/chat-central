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
import { batchFetchDetails, cancelBatchFetch } from './services'
import type { Platform } from '@/types'
import { initLanguage } from '@/locales'
import { createLogger, getErrorMessage } from '@/utils/logger'

const log = createLogger('ChatCentral')

export default defineBackground({
  type: 'module',

  main() {
    log.info('Background service worker started')

    initLanguage()
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
  },
})

// Generic helper to safely call addListener on browser event targets
// that may be undefined (e.g. browser.contextMenus?.onClicked).
// Uses generic constraint to preserve handler type safety.
// eslint-disable-next-line ts/no-explicit-any
function safeAddListener<T extends (...args: any[]) => any>(
  target: { addListener?: (handler: T) => void } | undefined,
  handler: T
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

    // Batch Fetch and Export
    case 'BATCH_FETCH_AND_EXPORT': {
      const msg = message as unknown as { platform: Platform; limit?: number }
      batchFetchDetails(msg.platform, msg.limit).catch((e) => {
        log.error('Batch fetch failed:', e)
      })
      return { success: true }
    }

    case 'BATCH_FETCH_CANCEL':
      cancelBatchFetch()
      return { success: true }

    default:
      log.warn('Unknown action:', action)
      return { error: 'Unknown action' }
  }
}
