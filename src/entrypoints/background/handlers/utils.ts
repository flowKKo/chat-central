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
 * Create a notification message and send it safely
 */
export function notifyExtensionPages(action: string, data: Record<string, unknown> = {}): void {
  sendMessageSafe({ action, ...data })
}
