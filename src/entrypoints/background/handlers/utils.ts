import { browser } from 'wxt/browser'

/**
 * Send a message safely, ignoring errors when no receiver is available
 *
 * This is useful for sending notifications that don't require a response,
 * such as broadcasting events to extension pages that may or may not be open.
 */
export function sendMessageSafe(message: unknown): void {
  browser.runtime.sendMessage(message).catch(() => {
    // No receivers (e.g., manage page not open) — safe to ignore
  })
}

/**
 * Send a message to content scripts on all tabs, ignoring errors.
 *
 * browser.runtime.sendMessage() only reaches extension pages (popup, manage, etc.).
 * Content scripts (like the Widget) need browser.tabs.sendMessage() instead.
 */
function sendToContentScripts(message: unknown): void {
  browser.tabs
    .query({})
    .then((tabs) => {
      for (const tab of tabs) {
        if (tab.id != null) {
          browser.tabs.sendMessage(tab.id, message).catch(() => {
            // Tab has no content script listener — safe to ignore
          })
        }
      }
    })
    .catch(() => {
      // tabs.query failed — safe to ignore
    })
}

/**
 * Create a notification message and send it to all extension contexts:
 * - Extension pages (popup, manage) via runtime.sendMessage
 * - Content scripts (widget) via tabs.sendMessage
 */
export function notifyExtensionPages(action: string, data: Record<string, unknown> = {}): void {
  const message = { action, ...data }
  sendMessageSafe(message)
  sendToContentScripts(message)
}
