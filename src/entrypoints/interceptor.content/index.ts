import { defineContentScript } from 'wxt/sandbox'
import { getPlatformFromHost } from '@/utils/platform-adapters'

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

    console.log(`[ChatCentral] Interceptor loaded for ${platform}`)

    // Inject network request interceptors
    injectFetchInterceptor()
    injectXHRInterceptor()
  },
})

/**
 * Check if the URL needs to be intercepted
 */
function shouldCapture(url: string): boolean {
  // Claude
  if (url.includes('/api/organizations/') && url.includes('/chat_conversations')) {
    return true
  }
  // ChatGPT
  if (url.includes('/backend-api/conversation')) {
    return true
  }
  // Gemini
  if (
    url.includes('gemini.google.com') &&
    (url.includes('batchexecute') || url.includes('/conversations'))
  ) {
    return true
  }
  return false
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
    '*'
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
            console.log('[ChatCentral] Captured fetch response length:', text.length)
            const data = tryParseResponse(text)
            if (!data) return
            console.log('[ChatCentral] Successfully parsed response for:', url)
            sendCapturedData(url, data)
          })
          .catch((err) => {
            console.error('[ChatCentral] Failed to read response text:', err)
          })
      }
    } catch (e) {
      // Ignore errors, do not affect original request
      console.error('[ChatCentral] Fetch interceptor error:', e)
    }

    return response
  }
}

/**
 * Try to parse responses in various formats
 */
function tryParseResponse(text: string): any {
  if (!text) return null

  // 1. Try standard JSON
  try {
    return JSON.parse(text)
  } catch {
    // Ignore, continue to try other formats
  }

  // 2. Try Gemini format (starts with )]}')
  if (text.trim().startsWith(")]}'")) {
    try {
      const jsonText = text.substring(text.indexOf('\n') + 1)
      return JSON.parse(jsonText)
    } catch {
      // Leave it to the adapter
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

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    // Store URL for use in onload
    const rawUrl = url.toString()
    ;(this as any)._chatCentralUrl = toAbsoluteUrl(rawUrl)
    return originalOpen.call(this, method, url, async ?? true, username, password)
  }

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const url = (this as any)._chatCentralUrl as string

    if (url && shouldCapture(url)) {
      this.addEventListener('load', function () {
        try {
          console.log('[ChatCentral] Captured XHR response length:', this.responseText.length)
          const data = tryParseResponse(this.responseText)
          if (data) {
            console.log('[ChatCentral] Successfully parsed XHR response for:', url)
            sendCapturedData(url, data)
          }
        } catch (e) {
          console.error('[ChatCentral] Failed to process XHR response:', e)
        }
      })
    }

    return originalSend.call(this, body)
  }
}