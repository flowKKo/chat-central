import { z } from 'zod'

// ============================================================================
// Cloud Storage Provider Interface
// ============================================================================

/**
 * Cloud storage provider types
 */
export const cloudProviderTypeSchema = z.enum(['google-drive', 'webdav'])
export type CloudProviderType = z.infer<typeof cloudProviderTypeSchema>

/**
 * Cloud storage provider interface
 * Defines the contract for all cloud sync providers
 */
export interface CloudStorageProvider {
  readonly name: string
  readonly type: CloudProviderType

  // Connection management
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  isConnected: () => boolean

  // File operations
  upload: (data: string, filename: string) => Promise<void>
  download: (filename: string) => Promise<string | null>
  getLastModified: (filename: string) => Promise<number | null>
}

// ============================================================================
// Cloud Sync State Types
// ============================================================================

/**
 * Cloud sync operation status (for UI)
 */
export const cloudSyncOperationStatusSchema = z.enum(['idle', 'syncing', 'error', 'success'])
export type CloudSyncOperationStatus = z.infer<typeof cloudSyncOperationStatusSchema>

/**
 * Cloud sync state stored in extension storage
 */
export interface CloudSyncState {
  provider: CloudProviderType | null
  isConnected: boolean
  lastSyncAt: number | null
  autoSyncEnabled: boolean
  autoSyncIntervalMinutes: number
  error: string | null
}

/**
 * Default cloud sync state
 */
export const DEFAULT_CLOUD_SYNC_STATE: CloudSyncState = {
  provider: null,
  isConnected: false,
  lastSyncAt: null,
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: 5,
  error: null,
}

// ============================================================================
// Cloud Sync Error Types
// ============================================================================

/**
 * Error category for cloud sync operations
 */
export const cloudSyncErrorCategorySchema = z.enum([
  'network', // Network connectivity issues
  'auth', // Authentication/authorization issues
  'quota', // Storage quota exceeded
  'data', // Data parsing/validation issues
  'unknown', // Unknown errors
])
export type CloudSyncErrorCategory = z.infer<typeof cloudSyncErrorCategorySchema>

/**
 * User-friendly error messages for each category
 */
export const ERROR_USER_MESSAGES: Record<CloudSyncErrorCategory, string> = {
  network: 'Unable to connect. Please check your internet connection and try again.',
  auth: 'Authentication failed. Please reconnect your Google account.',
  quota: 'Google Drive storage is full. Please free up some space.',
  data: 'Failed to process sync data. Please try again or contact support.',
  unknown: 'An unexpected error occurred. Please try again.',
}

/**
 * Custom error class for cloud sync operations
 */
export class CloudSyncError extends Error {
  constructor(
    message: string,
    public readonly category: CloudSyncErrorCategory,
    public readonly retryable: boolean,
    public readonly userMessage: string = ERROR_USER_MESSAGES[category],
  ) {
    super(message)
    this.name = 'CloudSyncError'
  }

  /**
   * Create a CloudSyncError from an unknown error
   */
  static fromError(error: unknown): CloudSyncError {
    if (error instanceof CloudSyncError) {
      return error
    }

    const message = error instanceof Error ? error.message : String(error)
    const { category, retryable } = categorizeError(message)

    return new CloudSyncError(message, category, retryable)
  }
}

/**
 * Categorize an error message into a CloudSyncErrorCategory
 */
export function categorizeError(message: string): {
  category: CloudSyncErrorCategory
  retryable: boolean
} {
  const lowerMessage = message.toLowerCase()

  // Network errors
  if (
    lowerMessage.includes('network')
    || lowerMessage.includes('fetch')
    || lowerMessage.includes('connection')
    || lowerMessage.includes('timeout')
    || lowerMessage.includes('offline')
  ) {
    return { category: 'network', retryable: true }
  }

  // Auth errors
  if (
    lowerMessage.includes('401')
    || lowerMessage.includes('403')
    || lowerMessage.includes('unauthorized')
    || lowerMessage.includes('authentication')
    || lowerMessage.includes('token')
    || lowerMessage.includes('oauth')
    || lowerMessage.includes('permission')
  ) {
    return { category: 'auth', retryable: false }
  }

  // Quota errors
  if (
    lowerMessage.includes('quota')
    || lowerMessage.includes('storage')
    || lowerMessage.includes('413')
    || lowerMessage.includes('insufficient')
  ) {
    return { category: 'quota', retryable: false }
  }

  // Data errors
  if (
    lowerMessage.includes('parse')
    || lowerMessage.includes('json')
    || lowerMessage.includes('invalid')
    || lowerMessage.includes('corrupt')
    || lowerMessage.includes('format')
  ) {
    return { category: 'data', retryable: false }
  }

  // Server errors (5xx) - retryable
  if (/5\d{2}/.test(lowerMessage)) {
    return { category: 'network', retryable: true }
  }

  // Default to unknown
  return { category: 'unknown', retryable: false }
}

// ============================================================================
// Cloud Sync Result Types
// ============================================================================

/**
 * Result of a cloud sync operation
 */
export interface CloudSyncResult {
  success: boolean
  direction: 'upload' | 'download' | 'merge'
  stats: {
    conversationsUploaded: number
    conversationsDownloaded: number
    messagesUploaded: number
    messagesDownloaded: number
  }
  error?: string
  errorCategory?: CloudSyncErrorCategory
  userMessage?: string
}

/**
 * Create an empty sync result
 */
export function createEmptyCloudSyncResult(
  direction: CloudSyncResult['direction'],
): CloudSyncResult {
  return {
    success: true,
    direction,
    stats: {
      conversationsUploaded: 0,
      conversationsDownloaded: 0,
      messagesUploaded: 0,
      messagesDownloaded: 0,
    },
  }
}

// ============================================================================
// Google Drive Types
// ============================================================================

/**
 * Google Drive file metadata
 */
export interface DriveFileMetadata {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
}

/**
 * Google Drive file list response
 */
export interface DriveFileListResponse {
  files: DriveFileMetadata[]
  nextPageToken?: string
}
