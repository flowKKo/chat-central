import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/sandbox'
import { handleContextMenuClick, handleContextMenuShown, registerContextMenus } from './contextMenu'
import { connectDevReloadServer } from './devReload'
import {
  handleCapturedResponse,
  handleGetAllTags,
  handleGetConversations,
  handleGetMessages,
  handleGetRecentConversations,
  handleGetStats,
  handleSearch,
  handleSearchWithMatches,
  handleToggleFavorite,
  handleUpdateTags,
} from './handlers'
import { batchFetchDetails, cancelBatchFetch } from './services'
import { BatchFetchAndExportSchema } from './schemas'
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

    // Handle keyboard shortcut commands
    safeAddListener(browser.commands?.onCommand, (command: string) => {
      if (command === 'toggle-spotlight') {
        handleSpotlightCommand()
      }
    })

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
      const parseResult = BatchFetchAndExportSchema.safeParse(message)
      if (!parseResult.success) {
        log.warn('Invalid batch fetch message:', parseResult.error.message)
        return { error: 'Invalid message format' }
      }
      batchFetchDetails(parseResult.data.platform, parseResult.data.limit).catch((e) => {
        log.error('Batch fetch failed:', e)
      })
      return { success: true }
    }

    case 'BATCH_FETCH_CANCEL':
      cancelBatchFetch()
      return { success: true }

    case 'SEARCH_WITH_MATCHES':
      return handleSearchWithMatches(message)

    case 'GET_RECENT_CONVERSATIONS':
      return handleGetRecentConversations(message)

    case 'OPEN_EXTENSION_PAGE': {
      const path = (message as unknown as { path: unknown }).path
      // Validate: must be a string, start with /manage.html, and only contain safe characters
      if (typeof path === 'string' && /^\/manage\.html(?:#[\w/=-]*)?$/.test(path)) {
        const url = browser.runtime.getURL(path as `/manage.html${string}`)
        await browser.tabs.create({ url })
        return { success: true }
      }
      return { error: 'Invalid path' }
    }

    default:
      log.warn('Unknown action:', action)
      return { error: 'Unknown action' }
  }
}

/**
 * Handle Spotlight toggle command (Cmd/Ctrl+Shift+K)
 */
async function handleSpotlightCommand() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  try {
    // Try to toggle an already-loaded Spotlight content script
    await browser.tabs.sendMessage(tab.id, { action: 'TOGGLE_SPOTLIGHT' })
  } catch {
    // Content script not loaded on this page — inject it, then toggle open
    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-scripts/spotlight.js'],
      })
      // Script starts hidden; send toggle to open it
      await browser.tabs.sendMessage(tab.id, { action: 'TOGGLE_SPOTLIGHT' })
    } catch (e) {
      log.warn('Cannot inject Spotlight into this tab:', e)
    }
  }
}
