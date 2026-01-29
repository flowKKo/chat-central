import type { DriveFileListResponse, DriveFileMetadata } from '../cloud-types'

// ============================================================================
// Constants
// ============================================================================

const DRIVE_API_BASE = 'https://www.googleapis.com'
const DRIVE_FILES_ENDPOINT = `${DRIVE_API_BASE}/drive/v3/files`
const DRIVE_UPLOAD_ENDPOINT = `${DRIVE_API_BASE}/upload/drive/v3/files`

// ============================================================================
// File Operations
// ============================================================================

/**
 * Search for a file by name in the appDataFolder
 * Returns the file ID if found, null otherwise
 */
export async function findFile(token: string, filename: string): Promise<string | null> {
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

  return file ? file.id : null
}

/**
 * Create a new file in the appDataFolder
 * Returns the file ID of the created file
 */
export async function createFile(
  token: string,
  filename: string,
  content: string
): Promise<string> {
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
  return data.id
}

/**
 * Update an existing file's content
 */
export async function updateFile(token: string, fileId: string, content: string): Promise<void> {
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

/**
 * Download a file's content by ID
 * Returns the file content as a string
 */
export async function downloadFile(token: string, fileId: string): Promise<string> {
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

/**
 * Get the last modified timestamp of a file
 * Returns the timestamp in milliseconds, or null if not available
 */
export async function getFileLastModified(token: string, fileId: string): Promise<number | null> {
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
