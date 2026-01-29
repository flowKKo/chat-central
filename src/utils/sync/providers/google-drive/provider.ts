import type { CloudStorageProvider } from '../cloud-types'
import { syncLogger } from '../../utils'
import { getAuthToken, removeCachedAuthToken, revokeToken, validateToken } from './auth'
import {
  createFile,
  downloadFile,
  findFile,
  getFileLastModified,
  updateFile,
} from './file-operations'
import { withRetry } from './retry'

// ============================================================================
// Constants
// ============================================================================

// File is stored in appDataFolder (hidden from user, app-specific)
const SYNC_FILENAME = 'chat-central-sync.json'

// ============================================================================
// Google Drive Provider Implementation
// ============================================================================

export class GoogleDriveProvider implements CloudStorageProvider {
  readonly name = 'Google Drive'
  readonly type = 'google-drive' as const

  private accessToken: string | null = null
  private cachedFileId: string | null = null
  // Prevent concurrent token refresh requests (race condition fix)
  private tokenRefreshPromise: Promise<string> | null = null

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  async connect(): Promise<void> {
    try {
      const token = await getAuthToken(true)
      this.accessToken = token
      syncLogger.info('Connected to Google Drive')
    } catch (error) {
      syncLogger.error('Failed to connect to Google Drive', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to connect to Google Drive')
    }
  }

  async disconnect(): Promise<void> {
    if (this.accessToken) {
      try {
        // Revoke the token
        await revokeToken(this.accessToken)
      } catch (error) {
        syncLogger.warn('Failed to revoke token', error)
      }
    }

    // Store token before clearing for removeCachedAuthToken
    const tokenToRemove = this.accessToken

    // Clear cached credentials
    this.accessToken = null
    this.cachedFileId = null

    // Clear cached auth token in Chrome
    if (tokenToRemove) {
      try {
        await removeCachedAuthToken(tokenToRemove)
      } catch (error) {
        syncLogger.warn('Failed to remove cached auth token', error)
      }
    }

    syncLogger.info('Disconnected from Google Drive')
  }

  isConnected(): boolean {
    return this.accessToken !== null
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  async upload(data: string, filename: string = SYNC_FILENAME): Promise<void> {
    await withRetry(async () => {
      const token = await this.ensureToken()

      // Check if file already exists
      const existingFileId = await this.findFileWithCache(filename)

      if (existingFileId) {
        // Update existing file
        await updateFile(token, existingFileId, data)
        syncLogger.info('Updated existing sync file in Google Drive')
      } else {
        // Create new file
        const newFileId = await createFile(token, filename, data)
        this.cachedFileId = newFileId
        syncLogger.info('Created new sync file in Google Drive')
      }
    })
  }

  async download(filename: string = SYNC_FILENAME): Promise<string | null> {
    return withRetry(async () => {
      const token = await this.ensureToken()

      const fileId = await this.findFileWithCache(filename)
      if (!fileId) {
        syncLogger.info('Sync file not found in Google Drive')
        return null
      }

      return downloadFile(token, fileId)
    })
  }

  async getLastModified(filename: string = SYNC_FILENAME): Promise<number | null> {
    return withRetry(async () => {
      const token = await this.ensureToken()

      const fileId = await this.findFileWithCache(filename)
      if (!fileId) {
        return null
      }

      return getFileLastModified(token, fileId)
    })
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private async ensureToken(): Promise<string> {
    // If token exists, validate it first
    if (this.accessToken) {
      try {
        await validateToken(this.accessToken)
        return this.accessToken
      } catch {
        syncLogger.info('Token expired, refreshing...')
        // Clear invalid token
        this.accessToken = null
      }
    }

    // If a token refresh is already in progress, wait for it (prevents race condition)
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise
    }

    // Start a new token refresh
    this.tokenRefreshPromise = this.refreshToken()

    try {
      const token = await this.tokenRefreshPromise
      this.accessToken = token
      return token
    } finally {
      // Clear the promise so next call can start fresh if needed
      this.tokenRefreshPromise = null
    }
  }

  /**
   * Refresh the access token (non-interactive first, then interactive)
   */
  private async refreshToken(): Promise<string> {
    try {
      // Try non-interactive first (uses cached credentials)
      return await getAuthToken(false)
    } catch {
      // Fall back to interactive (shows OAuth popup)
      return await getAuthToken(true)
    }
  }

  /**
   * Find a file by name, using the cached file ID if available
   */
  private async findFileWithCache(filename: string): Promise<string | null> {
    // Use cached file ID if available
    if (this.cachedFileId) {
      return this.cachedFileId
    }

    const token = await this.ensureToken()
    const fileId = await findFile(token, filename)

    if (fileId) {
      this.cachedFileId = fileId
    }

    return fileId
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Google Drive provider instance
 */
export function createGoogleDriveProvider(): GoogleDriveProvider {
  return new GoogleDriveProvider()
}
