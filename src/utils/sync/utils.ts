// ============================================================================
// Shared Sync Utilities
// ============================================================================

import { createLogger } from '@/utils/logger'

/**
 * Logger with [Sync] prefix for all sync-related operations
 */
export const syncLogger = createLogger('Sync')

/**
 * Calculate SHA-256 hash of a string
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Convert array of objects to JSONL format
 */
export function toJsonl<T>(items: T[]): string {
  return items.map((item) => JSON.stringify(item)).join('\n')
}

/**
 * Parse JSONL content into array of typed objects with validation
 */
export function parseJsonl<T>(
  content: string,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: unknown } },
  onError?: (line: number, message: string) => void
): T[] {
  const items: T[] = []
  const lines = content.split('\n').filter((line) => line.trim())

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    try {
      const parsed = JSON.parse(line)
      const validated = schema.safeParse(parsed)

      if (validated.success && validated.data) {
        items.push(validated.data)
      } else {
        onError?.(i + 1, 'Invalid data format')
      }
    } catch {
      onError?.(i + 1, 'Invalid JSON')
    }
  }

  return items
}

/**
 * Download a blob as a file in the browser
 * Returns true if download was successful, false otherwise
 */
export function downloadBlob(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  } catch (error) {
    syncLogger.error('Failed to download file', error)
    return false
  }
}

/**
 * Generate a safe filename from a title
 * Removes special characters and limits length
 */
export function generateSafeFilename(title: string, extension: string, maxLength = 50): string {
  const safeTitle = title
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
  return `${safeTitle || 'untitled'}${extension}`
}

/** Maximum recommended file size for import (100MB) */
export const MAX_IMPORT_FILE_SIZE = 100 * 1024 * 1024

/**
 * Check if file size is within safe limits
 */
export function isFileSizeSafe(file: File): { safe: boolean; sizeFormatted: string } {
  const sizeFormatted = formatFileSize(file.size)
  return {
    safe: file.size <= MAX_IMPORT_FILE_SIZE,
    sizeFormatted,
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Format date for filename (YYYYMMDD_HHmmss)
 */
export function formatDateForFilename(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}
