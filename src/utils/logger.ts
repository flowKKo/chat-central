// ============================================================================
// Centralized Logger & Error Utilities
// ============================================================================

export interface Logger {
  error: (msg: string, error?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  info: (msg: string, data?: unknown) => void
  debug: (msg: string, data?: unknown) => void
}

/**
 * Create a logger with a consistent prefix tag.
 *
 * Usage:
 *   const log = createLogger('CloudSync')
 *   log.error('Failed to connect:', error)
 *   // → console.error('[CloudSync] Failed to connect:', <error>)
 */
export function createLogger(prefix: string): Logger {
  const tag = `[${prefix}]`
  return {
    error(msg: string, error?: unknown) {
      console.error(`${tag} ${msg}`, error ?? '')
    },
    warn(msg: string, data?: unknown) {
      console.warn(`${tag} ${msg}`, data ?? '')
    },
    info(msg: string, data?: unknown) {
      if (data !== undefined) {
        console.info(`${tag} ${msg}`, data)
      }
      else {
        console.info(`${tag} ${msg}`)
      }
    },
    debug(msg: string, data?: unknown) {
      if (import.meta.env.DEV) {
        if (data !== undefined) {
          console.log(`${tag} ${msg}`, data)
        }
        else {
          console.log(`${tag} ${msg}`)
        }
      }
    },
  }
}

/**
 * Extract a human-readable error message from an unknown catch parameter.
 *
 * Replaces the common pattern:
 *   const msg = e instanceof Error ? e.message : 'fallback'
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}
