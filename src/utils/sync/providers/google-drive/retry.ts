import { syncLogger } from '../../utils'

// ============================================================================
// Retry Utilities
// ============================================================================

export interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
}

/**
 * Check if an error is retryable based on HTTP status or error type
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    // Network errors
    if (message.includes('network') || message.includes('fetch')) return true
    // Timeout errors
    if (message.includes('timeout')) return true
    // Server errors (5xx)
    if (/status[:\s]*5\d{2}/.test(message)) return true
    // Rate limiting
    if (message.includes('429') || message.includes('rate limit')) return true
  }
  return false
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_RETRY_OPTIONS, ...options }

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if not retryable or last attempt
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw lastError
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelayMs * 2 ** attempt
      const jitter = Math.random() * 0.3 * exponentialDelay // 0-30% jitter
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs)

      syncLogger.info(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError ?? new Error('Retry failed')
}
