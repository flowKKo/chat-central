import { browser } from 'wxt/browser'

const DEV_RELOAD_PORT = 3717
const RECONNECT_DELAY = 3000

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

  function connect() {
    try {
      const ws = new WebSocket(`ws://localhost:${DEV_RELOAD_PORT}`)

      ws.onopen = () => {
        console.log('[ChatCentral] Connected to dev reload server')
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'reload') {
            console.log('[ChatCentral] Reload signal received, reloading extension...')
            browser.runtime.reload()
          }
        } catch (e) {
          console.warn('[ChatCentral] Failed to parse dev reload message:', e)
        }
      }

      ws.onclose = () => {
        console.log('[ChatCentral] Disconnected from dev reload server')
        scheduleReconnect()
      }

      ws.onerror = () => {
        // Error will be followed by close event, no need to handle here
      }
    } catch (e) {
      console.warn('[ChatCentral] Failed to connect to dev reload server:', e)
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RECONNECT_DELAY)
  }

  // Initial connection
  connect()
}
