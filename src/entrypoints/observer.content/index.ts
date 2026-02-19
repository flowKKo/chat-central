import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/sandbox'
import { getPlatformFromHost } from '@/utils/platform-adapters'
import { createLogger } from '@/utils/logger'

const log = createLogger('Observer')

// Track extension lifecycle to avoid repeated errors after reload/update
let contextInvalidated = false
let messageHandler: ((event: MessageEvent) => void) | null = null
let fetchRelayHandler: ((message: unknown) => void) | null = null

function isContextInvalidatedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Extension context invalidated')
}

function teardown() {
  if (contextInvalidated) return
  contextInvalidated = true
  log.warn('Extension context invalidated. Reload the page to reconnect.')

  if (messageHandler) {
    window.removeEventListener('message', messageHandler)
    messageHandler = null
  }

  if (fetchRelayHandler) {
    browser.runtime.onMessage.removeListener(fetchRelayHandler)
    fetchRelayHandler = null
  }
}

/**
 * Observer Content Script
 *
 * This script runs in the isolated extension context
 * Responsibilities:
 * 1. Receive postMessage from interceptor.content
 * 2. Forward data to background service worker
 *
 * Note: DOM observation is disabled because:
 * - The handler was a stub with no actual functionality
 * - MutationObserver with subtree:true caused significant page lag
 * - API interception already captures all conversation data reliably
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

    // Listen for fetch-detail requests from background
    setupFetchRelay()
  },
})

/**
 * Setup postMessage listener
 */
function setupMessageListener() {
  // Cleanup old listener if exists (prevents orphaned handlers on re-init)
  if (messageHandler) {
    window.removeEventListener('message', messageHandler)
  }

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
 * Relay fetch-detail requests from background to MAIN world interceptor
 */
function setupFetchRelay() {
  // Cleanup old listener if exists
  if (fetchRelayHandler) {
    browser.runtime.onMessage.removeListener(fetchRelayHandler)
  }

  fetchRelayHandler = (message: unknown) => {
    if (contextInvalidated) return
    if (
      typeof message !== 'object' ||
      message === null ||
      (message as Record<string, unknown>).action !== 'FETCH_CONVERSATION_DETAIL'
    ) {
      return
    }

    const url = (message as Record<string, unknown>).url as string
    log.debug('Relaying fetch-detail request:', url)

    window.postMessage(
      {
        type: 'CHAT_CENTRAL_FETCH_DETAIL',
        url,
      },
      window.location.origin
    )
  }
  browser.runtime.onMessage.addListener(fetchRelayHandler)
}
