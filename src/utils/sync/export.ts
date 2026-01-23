import JSZip from 'jszip'
import type { Message, Platform } from '@/types'
import {
  getAllConversationsForExport,
  getAllMessagesForExport,
  getSyncState,
  initializeSyncState,
} from '@/utils/db'
import type { ExportManifest, ExportOptionsSync } from './types'

// ============================================================================
// Constants
// ============================================================================

const EXPORT_VERSION = '1.0'
const FILENAME_CONVERSATIONS = 'conversations.jsonl'
const FILENAME_MESSAGES = 'messages.jsonl'
const FILENAME_MANIFEST = 'manifest.json'

// ============================================================================
// Export Functions
// ============================================================================

export interface ExportResult {
  blob: Blob
  filename: string
  stats: {
    conversations: number
    messages: number
    sizeBytes: number
  }
}

/**
 * Export data to a ZIP file containing JSONL files
 */
export async function exportData(options: ExportOptionsSync = { type: 'full' }): Promise<ExportResult> {
  // Get sync state for device ID
  let syncState = await getSyncState()
  if (!syncState) {
    syncState = await initializeSyncState()
  }

  // Fetch conversations
  const conversations = await getAllConversationsForExport({
    since: options.type === 'incremental' ? options.since : undefined,
    platforms: options.platforms,
    includeDeleted: options.includeDeleted,
  })

  // Fetch messages for these conversations
  const conversationIds = conversations.map((c) => c.id)
  const messages = await getAllMessagesForExport(conversationIds, {
    includeDeleted: options.includeDeleted,
  })

  // Generate JSONL content
  const conversationsJsonl = toJsonl(conversations)
  const messagesJsonl = toJsonl(messages)

  // Calculate checksums
  const conversationsChecksum = await sha256(conversationsJsonl)
  const messagesChecksum = await sha256(messagesJsonl)

  // Create manifest
  const manifest: ExportManifest = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    deviceId: syncState.deviceId,
    counts: {
      conversations: conversations.length,
      messages: messages.length,
    },
    checksums: {
      [FILENAME_CONVERSATIONS]: conversationsChecksum,
      [FILENAME_MESSAGES]: messagesChecksum,
    },
    exportType: options.type,
    sinceTimestamp: options.type === 'incremental' ? (options.since ?? null) : null,
    encrypted: false,
  }

  // Create ZIP
  const zip = new JSZip()
  zip.file(FILENAME_MANIFEST, JSON.stringify(manifest, null, 2))
  zip.file(FILENAME_CONVERSATIONS, conversationsJsonl)
  zip.file(FILENAME_MESSAGES, messagesJsonl)

  // Generate blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  // Generate filename
  const dateStr = formatDateForFilename(new Date())
  const typeStr = options.type === 'incremental' ? '_incremental' : ''
  const filename = `chatcentral_export_${dateStr}${typeStr}.zip`

  return {
    blob,
    filename,
    stats: {
      conversations: conversations.length,
      messages: messages.length,
      sizeBytes: blob.size,
    },
  }
}

/**
 * Export specific conversations
 */
export async function exportConversations(
  conversationIds: string[],
  options: Omit<ExportOptionsSync, 'type' | 'since' | 'platforms'> = {}
): Promise<ExportResult> {
  // Get sync state for device ID
  let syncState = await getSyncState()
  if (!syncState) {
    syncState = await initializeSyncState()
  }

  // Fetch specified conversations
  const allConversations = await getAllConversationsForExport({
    includeDeleted: options.includeDeleted,
  })
  const conversations = allConversations.filter((c) => conversationIds.includes(c.id))

  // Fetch messages for these conversations
  const messages = await getAllMessagesForExport(conversationIds, {
    includeDeleted: options.includeDeleted,
  })

  // Generate JSONL content
  const conversationsJsonl = toJsonl(conversations)
  const messagesJsonl = toJsonl(messages)

  // Calculate checksums
  const conversationsChecksum = await sha256(conversationsJsonl)
  const messagesChecksum = await sha256(messagesJsonl)

  // Create manifest
  const manifest: ExportManifest = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    deviceId: syncState.deviceId,
    counts: {
      conversations: conversations.length,
      messages: messages.length,
    },
    checksums: {
      [FILENAME_CONVERSATIONS]: conversationsChecksum,
      [FILENAME_MESSAGES]: messagesChecksum,
    },
    exportType: 'full',
    sinceTimestamp: null,
    encrypted: false,
  }

  // Create ZIP
  const zip = new JSZip()
  zip.file(FILENAME_MANIFEST, JSON.stringify(manifest, null, 2))
  zip.file(FILENAME_CONVERSATIONS, conversationsJsonl)
  zip.file(FILENAME_MESSAGES, messagesJsonl)

  // Generate blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  // Generate filename
  const dateStr = formatDateForFilename(new Date())
  const filename = `chatcentral_export_${dateStr}_selected.zip`

  return {
    blob,
    filename,
    stats: {
      conversations: conversations.length,
      messages: messages.length,
      sizeBytes: blob.size,
    },
  }
}

/**
 * Download export result as a file
 */
export function downloadExport(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert array of objects to JSONL format
 */
function toJsonl<T>(items: T[]): string {
  return items.map((item) => JSON.stringify(item)).join('\n')
}

/**
 * Calculate SHA-256 hash of a string
 */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Format date for filename (YYYYMMDD_HHmmss)
 */
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

// ============================================================================
// Export to JSON (Simple format for debugging/viewing)
// ============================================================================

export interface SimpleExportResult {
  blob: Blob
  filename: string
}

/**
 * Export to a simple JSON file (for debugging/viewing)
 */
export async function exportToJson(options: {
  platforms?: Platform[]
  includeDeleted?: boolean
} = {}): Promise<SimpleExportResult> {
  const conversations = await getAllConversationsForExport({
    platforms: options.platforms,
    includeDeleted: options.includeDeleted,
  })

  const conversationIds = conversations.map((c) => c.id)
  const messages = await getAllMessagesForExport(conversationIds, {
    includeDeleted: options.includeDeleted,
  })

  // Group messages by conversation
  const messagesByConversation = new Map<string, Message[]>()
  for (const msg of messages) {
    const existing = messagesByConversation.get(msg.conversationId) || []
    existing.push(msg)
    messagesByConversation.set(msg.conversationId, existing)
  }

  // Build export structure
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    conversations: conversations.map((conv) => ({
      ...conv,
      messages: messagesByConversation.get(conv.id) || [],
    })),
  }

  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })

  const dateStr = formatDateForFilename(new Date())
  const filename = `chatcentral_export_${dateStr}.json`

  return { blob, filename }
}
