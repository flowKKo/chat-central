/**
 * Standardized handler result types for background message handlers
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes for handler failures
 */
export type HandlerErrorCode =
  | 'INVALID_FORMAT'
  | 'NOT_FOUND'
  | 'NO_ADAPTER'
  | 'PARSE_ERROR'
  | 'DB_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN'

// ============================================================================
// Result Types
// ============================================================================

/**
 * Standardized success result
 */
export interface HandlerSuccess<T> {
  success: true
  data: T
}

/**
 * Standardized failure result
 */
export interface HandlerFailure {
  success: false
  error: string
  code?: HandlerErrorCode
}

/**
 * Unified handler result type
 */
export type HandlerResult<T> = HandlerSuccess<T> | HandlerFailure

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a success result
 */
export function success<T>(data: T): HandlerResult<T> {
  return { success: true, data }
}

/**
 * Create a failure result
 */
export function failure<T>(error: string, code?: HandlerErrorCode): HandlerResult<T> {
  return { success: false, error, code }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if result is successful
 */
export function isSuccess<T>(result: HandlerResult<T>): result is HandlerSuccess<T> {
  return result.success === true
}

/**
 * Check if result is failure
 */
export function isFailure<T>(result: HandlerResult<T>): result is HandlerFailure {
  return result.success === false
}
