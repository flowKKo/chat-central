import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/sandbox'
import { getPlatformFromHost } from '@/utils/platform-adapters'
import { createLogger } from '@/utils/logger'

const log = createLogger('Observer')

// Track extension lifecycle to avoid repeated errors after reload/update
let contextInvalidated = false
let domObserver: MutationObserver | null = null
let messageHandler: ((event: MessageEvent) => void) | null = null

function isContextInvalidatedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Extension context invalidated')
}

function teardown() {
  if (contextInvalidated) return
  contextInvalidated = true
  log.warn('Extension context invalidated. Reload the page to reconnect.')

  if (domObserver) {
    domObserver.disconnect()
    domObserver = null
  }
  if (messageHandler) {
    window.removeEventListener('message', messageHandler)
    messageHandler = null
  }
}

/**
 * Observer Content Script
 *
 * This script runs in the isolated extension context
 * Responsibilities:
 * 1. Receive postMessage from interceptor.content
 * 2. Forward data to background service worker
 * 3. Monitor DOM changes as a backup data source
 */
export default defineContentScript({
  matches: [
    'https://claude.ai/*',
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://gemini.google.com/*',
  ],
  runAt: 'document_start',

  main() {
    const platform = getPlatformFromHost(window.location.hostname)
    if (!platform) return

    log.info(`Loaded for ${platform}`)

    // Listen for messages from interceptor.content
    setupMessageListener()

    // Initialize DOM observer after page load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setupDOMObserver(platform)
      })
    } else {
      setupDOMObserver(platform)
    }
  },
})

/**
 * Setup postMessage listener
 */
function setupMessageListener() {
  messageHandler = (event: MessageEvent) => {
    if (contextInvalidated) return

    // Only accept messages from the same origin
    if (event.source !== window) return
    if (event.data?.type !== 'CHAT_CENTRAL_CAPTURE') return

    const { url, data, timestamp } = event.data

    log.debug('Received captured data:', url)

    // Forward to background
    browser.runtime
      .sendMessage({
        action: 'CAPTURE_API_RESPONSE',
        url,
        data,
        timestamp,
      })
      .catch((e: unknown) => {
        if (isContextInvalidatedError(e)) {
          teardown()
        } else {
          log.error('Failed to send to background:', e)
        }
      })
  }
  window.addEventListener('message', messageHandler)
}

/**
 * Setup DOM observer (as a backup data source)
 */
function setupDOMObserver(platform: string) {
  if (contextInvalidated) return

  // Set different selectors based on platform
  const selectors = getSelectors(platform)
  if (!selectors) return

  // Use MutationObserver to monitor conversation changes
  domObserver = new MutationObserver((mutations) => {
    if (contextInvalidated) return
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        handleDOMMutation(mutation, platform, selectors)
      }
    }
  })

  // Wait for container to appear
  waitForElement(selectors.container).then((container) => {
    if (contextInvalidated || !domObserver) return
    if (container) {
      log.info('DOM observer started')
      domObserver.observe(container, {
        childList: true,
        subtree: true,
      })
    }
  })
}

interface PlatformSelectors {
  container: string
  messageItem: string
  userMessage: string
  assistantMessage: string
}

function getSelectors(platform: string): PlatformSelectors | null {
  switch (platform) {
    case 'claude':
      return {
        container: '[data-testid="conversation-turn-list"], .conversation-content',
        messageItem: '[data-testid="conversation-turn"]',
        userMessage: '.font-user-message, [data-testid="user-message"]',
        assistantMessage: '.font-claude-message, [data-testid="assistant-message"]',
      }
    case 'chatgpt':
      return {
        container: '[class*="react-scroll-to-bottom"], main',
        messageItem: '[data-message-author-role]',
        userMessage: '[data-message-author-role="user"]',
        assistantMessage: '[data-message-author-role="assistant"]',
      }
    case 'gemini':
      return {
        container: '.conversation-container, [class*="conversation"]',
        messageItem: '.message-content, [class*="message"]',
        userMessage: '.query-content, [class*="user"]',
        assistantMessage: '.response-content, [class*="model"]',
      }
    default:
      return null
  }
}

function handleDOMMutation(
  mutation: MutationRecord,
  _platform: string,
  _selectors: PlatformSelectors
) {
  // Simple debounce
  // Full implementation requires parsing DOM content and merging with API data
  // Here we just mark that there is new content
  for (const node of mutation.addedNodes) {
    if (node instanceof HTMLElement) {
      // New message detected, trigger incremental sync
      // console.log('[ChatCentral] New DOM content detected')
    }
  }
}

/**
 * Wait for element to appear
 */
function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) {
        observer.disconnect()
        resolve(element)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}
