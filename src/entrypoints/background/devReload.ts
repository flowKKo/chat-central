import { browser } from 'wxt/browser'
import { createLogger } from '@/utils/logger'

const log = createLogger('ChatCentral')

const DEV_RELOAD_PORT = 3717
const INITIAL_RECONNECT_DELAY = 3000
const MAX_RECONNECT_DELAY = 60000

/**
 * Connect to dev reload WebSocket server (development only)
 * This allows automatic extension reload when the dev server sends a reload signal
 */
export function connectDevReloadServer() {
  // Only connect in development mode
  if (import.meta.env.MODE !== 'development') {
    return
  }

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = INITIAL_RECONNECT_DELAY
  let failCount = 0

  function connect() {
    try {
      const ws = new WebSocket(`ws://localhost:${DEV_RELOAD_PORT}`)

      ws.onopen = () => {
        log.info('Connected to dev reload server')
        reconnectDelay = INITIAL_RECONNECT_DELAY
        failCount = 0
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'reload') {
            log.info('Reload signal received, reloading extension...')
            browser.runtime.reload()
          }
        } catch (e) {
          log.warn('Failed to parse dev reload message:', e)
        }
      }

      ws.onclose = () => {
        if (failCount === 0) {
          log.info('Disconnected from dev reload server')
        }
        scheduleReconnect()
      }

      ws.onerror = () => {
        // Error will be followed by close event, no need to handle here
      }
    } catch (e) {
      if (failCount === 0) {
        log.warn('Failed to connect to dev reload server:', e)
      }
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    failCount++
    if (failCount === 1) {
      log.info('Dev reload server not available. Retrying silently...')
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
  }

  // Initial connection
  connect()
}
