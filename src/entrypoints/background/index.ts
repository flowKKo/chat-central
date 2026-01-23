import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/sandbox'
import { handleContextMenuClick, handleContextMenuShown, registerContextMenus } from './contextMenu'
import { connectDevReloadServer } from './devReload'
import {
  handleCapturedResponse,
  handleGetConversations,
  handleGetMessages,
  handleGetStats,
  handleSearch,
  handleToggleFavorite,
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
    safeAddListener(browser.runtime?.onMessage, (message: any, _sender: any, sendResponse: any) => {
      handleMessage(message)
        .then(sendResponse)
        .catch((e) => {
          console.error('[ChatCentral] Message handler error:', e)
          sendResponse({ error: e.message })
        })
      return true // Keep message channel open to support asynchronous response
    })

    // Handle extension install/update
    safeAddListener(browser.runtime?.onInstalled, (details: any) => {
      if (details.reason === 'install') {
        console.log('[ChatCentral] Extension installed')
        // Open welcome page here
      } else if (details.reason === 'update') {
        console.log('[ChatCentral] Extension updated')
      }

      registerContextMenus()
    })

    // Dev reload: Connect to local WebSocket server for auto-reload
    connectDevReloadServer()
  },
})

// eslint-disable-next-line ts/no-explicit-any
function safeAddListener(target: any, handler: (...args: any[]) => void) {
  if (!target?.addListener) return
  target.addListener(handler)
}

/**
 * Message handler router
 */
// eslint-disable-next-line ts/no-explicit-any
async function handleMessage(message: any): Promise<any> {
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

    default:
      console.warn('[ChatCentral] Unknown action:', action)
      return { error: 'Unknown action' }
  }
}
