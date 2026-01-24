import { describe, expect, it } from 'vitest'
import { categorizeError, CloudSyncError, ERROR_USER_MESSAGES } from './cloud-types'

describe('categorizeError', () => {
  it('should categorize network errors', () => {
    expect(categorizeError('network error')).toEqual({ category: 'network', retryable: true })
    expect(categorizeError('fetch failed')).toEqual({ category: 'network', retryable: true })
    expect(categorizeError('connection refused')).toEqual({ category: 'network', retryable: true })
    expect(categorizeError('timeout exceeded')).toEqual({ category: 'network', retryable: true })
    expect(categorizeError('offline mode')).toEqual({ category: 'network', retryable: true })
  })

  it('should categorize server errors (5xx) as network errors', () => {
    expect(categorizeError('status 500')).toEqual({ category: 'network', retryable: true })
    expect(categorizeError('error 503')).toEqual({ category: 'network', retryable: true })
    expect(categorizeError('502 bad gateway')).toEqual({ category: 'network', retryable: true })
  })

  it('should categorize auth errors', () => {
    expect(categorizeError('401 unauthorized')).toEqual({ category: 'auth', retryable: false })
    expect(categorizeError('403 forbidden')).toEqual({ category: 'auth', retryable: false })
    expect(categorizeError('unauthorized access')).toEqual({ category: 'auth', retryable: false })
    expect(categorizeError('authentication failed')).toEqual({ category: 'auth', retryable: false })
    expect(categorizeError('token expired')).toEqual({ category: 'auth', retryable: false })
    expect(categorizeError('oauth error')).toEqual({ category: 'auth', retryable: false })
    expect(categorizeError('permission denied')).toEqual({ category: 'auth', retryable: false })
  })

  it('should categorize quota errors', () => {
    expect(categorizeError('quota exceeded')).toEqual({ category: 'quota', retryable: false })
    expect(categorizeError('storage full')).toEqual({ category: 'quota', retryable: false })
    expect(categorizeError('status 413')).toEqual({ category: 'quota', retryable: false })
    expect(categorizeError('insufficient space')).toEqual({ category: 'quota', retryable: false })
  })

  it('should categorize data errors', () => {
    expect(categorizeError('parse error')).toEqual({ category: 'data', retryable: false })
    expect(categorizeError('invalid json')).toEqual({ category: 'data', retryable: false })
    expect(categorizeError('invalid format')).toEqual({ category: 'data', retryable: false })
    expect(categorizeError('corrupt file')).toEqual({ category: 'data', retryable: false })
    expect(categorizeError('JSON.parse failed')).toEqual({ category: 'data', retryable: false })
  })

  it('should categorize unknown errors', () => {
    expect(categorizeError('something went wrong')).toEqual({
      category: 'unknown',
      retryable: false,
    })
    expect(categorizeError('unexpected error')).toEqual({ category: 'unknown', retryable: false })
    expect(categorizeError('')).toEqual({ category: 'unknown', retryable: false })
  })

  it('should be case insensitive', () => {
    expect(categorizeError('NETWORK ERROR')).toEqual({ category: 'network', retryable: true })
    expect(categorizeError('UNAUTHORIZED')).toEqual({ category: 'auth', retryable: false })
    expect(categorizeError('QUOTA EXCEEDED')).toEqual({ category: 'quota', retryable: false })
  })
})

describe('cloudSyncError', () => {
  it('should create error with correct properties', () => {
    const error = new CloudSyncError('test error', 'network', true)

    expect(error.message).toBe('test error')
    expect(error.category).toBe('network')
    expect(error.retryable).toBe(true)
    expect(error.userMessage).toBe(ERROR_USER_MESSAGES.network)
    expect(error.name).toBe('CloudSyncError')
  })

  it('should use custom user message when provided', () => {
    const customMessage = 'Custom error message'
    const error = new CloudSyncError('test error', 'auth', false, customMessage)

    expect(error.userMessage).toBe(customMessage)
  })

  it('should create from unknown error', () => {
    const error = CloudSyncError.fromError(new Error('network connection failed'))

    expect(error.category).toBe('network')
    expect(error.retryable).toBe(true)
    expect(error.userMessage).toBe(ERROR_USER_MESSAGES.network)
  })

  it('should return same error if already CloudSyncError', () => {
    const original = new CloudSyncError('test', 'auth', false)
    const result = CloudSyncError.fromError(original)

    expect(result).toBe(original)
  })

  it('should handle non-Error objects', () => {
    const error = CloudSyncError.fromError('string error')

    expect(error.message).toBe('string error')
    expect(error.category).toBe('unknown')
    expect(error.retryable).toBe(false)
  })

  it('should handle null/undefined', () => {
    const errorNull = CloudSyncError.fromError(null)
    const errorUndefined = CloudSyncError.fromError(undefined)

    expect(errorNull.message).toBe('null')
    expect(errorUndefined.message).toBe('undefined')
  })
})

describe('eRROR_USER_MESSAGES', () => {
  it('should have user-friendly messages for all categories', () => {
    expect(ERROR_USER_MESSAGES.network).toContain('internet')
    expect(ERROR_USER_MESSAGES.auth).toContain('reconnect')
    expect(ERROR_USER_MESSAGES.quota).toContain('full')
    expect(ERROR_USER_MESSAGES.data).toContain('sync data')
    expect(ERROR_USER_MESSAGES.unknown).toContain('unexpected')
  })
})
