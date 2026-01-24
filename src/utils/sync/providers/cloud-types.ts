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
}

/**
 * Create an empty sync result
 */
export function createEmptyCloudSyncResult(
  direction: CloudSyncResult['direction']
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
