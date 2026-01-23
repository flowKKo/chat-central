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

export default defineBackground({
  type: 'module',

  main() {
    console.log('[ChatCentral] Background service worker started')

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
            console.error('[ChatCentral] Message handler error:', e)
            const errorMessage = e instanceof Error ? e.message : 'Unknown error'
            sendResponse({ error: errorMessage })
          })
        return true // Keep message channel open to support asynchronous response
      }
    )

    // Handle extension install/update
    safeAddListener(
      browser.runtime?.onInstalled,
      (details: { reason: string; previousVersion?: string }) => {
        if (details.reason === 'install') {
          console.log('[ChatCentral] Extension installed')
          // Open welcome page here
        } else if (details.reason === 'update') {
          console.log('[ChatCentral] Extension updated')
        }

        registerContextMenus()
      }
    )

    // Dev reload: Connect to local WebSocket server for auto-reload
    connectDevReloadServer()
  },
})

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

    default:
      console.warn('[ChatCentral] Unknown action:', action)
      return { error: 'Unknown action' }
  }
}
