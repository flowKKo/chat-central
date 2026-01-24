import type { CloudStorageProvider, DriveFileListResponse, DriveFileMetadata } from './cloud-types'
import { syncLogger } from '../utils'

// ============================================================================
// Chrome Identity API Types
// ============================================================================

/**
 * Chrome identity API type declaration
 * Used for Google OAuth authentication in Chrome extensions
 */
interface ChromeIdentityAPI {
  getAuthToken: (options: { interactive: boolean }, callback: (token?: string) => void) => void
  removeCachedAuthToken: (options: { token: string }, callback: () => void) => void
}

interface ChromeRuntimeAPI {
  lastError?: { message: string }
}

interface ChromeAPI {
  identity?: ChromeIdentityAPI
  runtime?: ChromeRuntimeAPI
}

declare const chrome: ChromeAPI | undefined

// ============================================================================
// Constants
// ============================================================================

const DRIVE_API_BASE = 'https://www.googleapis.com'
const DRIVE_FILES_ENDPOINT = `${DRIVE_API_BASE}/drive/v3/files`
const DRIVE_UPLOAD_ENDPOINT = `${DRIVE_API_BASE}/upload/drive/v3/files`

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

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  async connect(): Promise<void> {
    try {
      const token = await this.getAuthToken(true)
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
        await this.revokeToken(this.accessToken)
      } catch (error) {
        syncLogger.warn('Failed to revoke token', error)
      }
    }

    // Clear cached credentials
    this.accessToken = null
    this.cachedFileId = null

    // Clear cached auth token in Chrome
    try {
      await this.removeCachedAuthToken()
    } catch (error) {
      syncLogger.warn('Failed to remove cached auth token', error)
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
    const token = await this.ensureToken()

    // Check if file already exists
    const existingFileId = await this.findFile(filename)

    if (existingFileId) {
      // Update existing file
      await this.updateFile(existingFileId, data, token)
      syncLogger.info('Updated existing sync file in Google Drive')
    } else {
      // Create new file
      await this.createFile(filename, data, token)
      syncLogger.info('Created new sync file in Google Drive')
    }
  }

  async download(filename: string = SYNC_FILENAME): Promise<string | null> {
    const token = await this.ensureToken()

    const fileId = await this.findFile(filename)
    if (!fileId) {
      syncLogger.info('Sync file not found in Google Drive')
      return null
    }

    const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
    }

    return response.text()
  }

  async getLastModified(filename: string = SYNC_FILENAME): Promise<number | null> {
    const token = await this.ensureToken()

    const fileId = await this.findFile(filename)
    if (!fileId) {
      return null
    }

    const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}?fields=modifiedTime`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.status}`)
    }

    const data = (await response.json()) as { modifiedTime?: string }
    if (data.modifiedTime) {
      return new Date(data.modifiedTime).getTime()
    }

    return null
  }

  // ===========================================================================
  // Private Helpers - Auth
  // ===========================================================================

  private async getAuthToken(interactive: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use chrome.identity API for OAuth
      if (!chrome?.identity?.getAuthToken) {
        reject(new Error('Chrome identity API not available'))
        return
      }

      chrome.identity.getAuthToken({ interactive }, (token?: string) => {
        if (chrome?.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        if (!token) {
          reject(new Error('No token received'))
          return
        }

        resolve(token)
      })
    })
  }

  private async ensureToken(): Promise<string> {
    if (this.accessToken) {
      // Try to use existing token, refresh if needed
      try {
        await this.validateToken(this.accessToken)
        return this.accessToken
      } catch {
        // Token invalid, try to get a new one
        syncLogger.info('Token expired, refreshing...')
      }
    }

    // Get a new token (non-interactive first, then interactive if needed)
    try {
      this.accessToken = await this.getAuthToken(false)
    } catch {
      this.accessToken = await this.getAuthToken(true)
    }

    return this.accessToken
  }

  private async validateToken(token: string): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
    )

    if (!response.ok) {
      throw new Error('Token validation failed')
    }
  }

  private async revokeToken(token: string): Promise<void> {
    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
      method: 'POST',
    })
  }

  private async removeCachedAuthToken(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!chrome?.identity?.removeCachedAuthToken) {
        resolve()
        return
      }

      if (!this.accessToken) {
        resolve()
        return
      }

      chrome.identity.removeCachedAuthToken({ token: this.accessToken }, () => {
        if (chrome?.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve()
      })
    })
  }

  // ===========================================================================
  // Private Helpers - File Operations
  // ===========================================================================

  private async findFile(filename: string): Promise<string | null> {
    // Use cached file ID if available
    if (this.cachedFileId) {
      return this.cachedFileId
    }

    const token = await this.ensureToken()

    // Search in appDataFolder
    const query = encodeURIComponent(`name='${filename}' and trashed=false`)
    const response = await fetch(
      `${DRIVE_FILES_ENDPOINT}?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.status}`)
    }

    const data = (await response.json()) as DriveFileListResponse
    const file = data.files?.[0]

    if (file) {
      this.cachedFileId = file.id
      return file.id
    }

    return null
  }

  private async createFile(filename: string, content: string, token: string): Promise<string> {
    const metadata = {
      name: filename,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', new Blob([content], { type: 'application/json' }))

    const response = await fetch(`${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create file: ${response.status} - ${error}`)
    }

    const data = (await response.json()) as DriveFileMetadata
    this.cachedFileId = data.id
    return data.id
  }

  private async updateFile(fileId: string, content: string, token: string): Promise<void> {
    const response = await fetch(`${DRIVE_UPLOAD_ENDPOINT}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: content,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to update file: ${response.status} - ${error}`)
    }
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
