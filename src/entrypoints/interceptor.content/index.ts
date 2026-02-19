import { defineContentScript } from 'wxt/sandbox'
import { getAdapterForUrl, getPlatformFromHost } from '@/utils/platform-adapters'
import { createLogger } from '@/utils/logger'

const log = createLogger('Interceptor')

/**
 * API Interceptor Content Script
 *
 * This script runs in the page context (world: 'MAIN')
 * Used to hook fetch/XHR to intercept API responses
 */
export default defineContentScript({
  matches: [
    'https://claude.ai/*',
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://gemini.google.com/*',
  ],
  runAt: 'document_start',
  world: 'MAIN', // Runs in the page context, not the isolated extension context

  main() {
    const platform = getPlatformFromHost(window.location.hostname)
    if (!platform) return

    log.info(`Loaded for ${platform}`)

    // Inject network request interceptors
    injectFetchInterceptor()
    injectXHRInterceptor()

    // Listen for active fetch-detail requests from observer
    setupFetchListener()
  },
})

/**
 * Check if the URL needs to be intercepted.
 * Delegates to platform adapters to avoid duplicating URL patterns.
 */
function shouldCapture(url: string): boolean {
  return getAdapterForUrl(url) !== null
}

/**
 * Send captured data to content script
 */
function sendCapturedData(url: string, data: unknown) {
  window.postMessage(
    {
      type: 'CHAT_CENTRAL_CAPTURE',
      url,
      data,
      timestamp: Date.now(),
    },
    window.location.origin
  )
}

function toAbsoluteUrl(url: string): string {
  try {
    return new URL(url, window.location.origin).toString()
  } catch {
    return url
  }
}

/**
 * Hook Fetch API
 */
function injectFetchInterceptor() {
  const originalFetch = window.fetch

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const response = await originalFetch.apply(this, args)

    try {
      const rawUrl =
        typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : ''
      const url = toAbsoluteUrl(rawUrl)

      if (shouldCapture(url)) {
        // Clone response for reading
        const clone = response.clone()

        // Read response asynchronously, without blocking the original request
        clone
          .text()
          .then((text) => {
            log.debug('Captured fetch response length:', text.length)
            const data = tryParseResponse(text)
            if (!data) return
            log.debug('Successfully parsed response for:', url)
            sendCapturedData(url, data)
          })
          .catch((err) => {
            log.error('Failed to read response text:', err)
          })
      }
    } catch (e) {
      // Ignore errors, do not affect original request
      log.error('Fetch interceptor error:', e)
    }

    return response
  }
}

/**
 * Try to parse responses in various formats
 */
function tryParseResponse(text: string): unknown {
  if (!text) return null

  // 1. Try standard JSON
  try {
    return JSON.parse(text)
  } catch {
    // Ignore, continue to try other formats
  }

  // 2. Try Gemini format (starts with )]}')
  if (text.trim().startsWith(")]}'")) {
    const newlineIndex = text.indexOf('\n')
    if (newlineIndex !== -1 && newlineIndex < text.length - 1) {
      try {
        return JSON.parse(text.substring(newlineIndex + 1))
      } catch {
        // Leave it to the adapter
      }
    }
  }

  // 3. Other formats (including SSE, batchexecute) are left to the adapter
  return text
}

/**
 * Hook XMLHttpRequest
 */
function injectXHRInterceptor() {
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send

  // Extend XMLHttpRequest to store URL for interception
  interface ExtendedXHR extends XMLHttpRequest {
    _chatCentralUrl?: string
  }

  XMLHttpRequest.prototype.open = function (
    this: ExtendedXHR,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    // Store URL for use in onload
    const rawUrl = url.toString()
    this._chatCentralUrl = toAbsoluteUrl(rawUrl)
    return originalOpen.call(this, method, url, async ?? true, username, password)
  }

  XMLHttpRequest.prototype.send = function (
    this: ExtendedXHR,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const url = this._chatCentralUrl

    if (url && shouldCapture(url)) {
      this.addEventListener(
        'load',
        function () {
          try {
            log.debug('Captured XHR response length:', this.responseText.length)
            const data = tryParseResponse(this.responseText)
            if (data) {
              log.debug('Successfully parsed XHR response for:', url)
              sendCapturedData(url, data)
            }
          } catch (e) {
            log.error('Failed to process XHR response:', e)
          }
        },
        { once: true }
      )
    }

    return originalSend.call(this, body)
  }
}

let fetchListener: ((event: MessageEvent) => void) | null = null

/**
 * Listen for fetch-detail requests from observer (ISOLATED world)
 * and call window.fetch — the hooked fetch automatically captures the response
 */
function setupFetchListener() {
  // Cleanup old listener on re-init to prevent accumulation
  if (fetchListener) {
    window.removeEventListener('message', fetchListener)
  }

  fetchListener = (event: MessageEvent) => {
    if (event.source !== window) return
    if (event.data?.type !== 'CHAT_CENTRAL_FETCH_DETAIL') return

    const url = event.data.url as string
    if (!url) return

    // Validate URL: must be HTTPS and match a capturable platform URL
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') return
    } catch {
      return
    }
    if (!shouldCapture(url)) return

    log.debug('Active fetch-detail request:', url)

    // Fire-and-forget: the hooked fetch will capture the response
    window.fetch(url).catch((e) => {
      log.error('Failed to fetch conversation detail:', e)
    })
  }

  window.addEventListener('message', fetchListener)
}
