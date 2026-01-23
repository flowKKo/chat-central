import JSZip from 'jszip'
import type { Message, Platform } from '@/types'
import {
  getAllConversationsForExport,
  getAllMessagesForExport,
  getSyncState,
  initializeSyncState,
} from '@/utils/db'
import type { ExportManifest } from './types'
import { sha256, toJsonl, formatDateForFilename, downloadBlob } from './utils'

// ============================================================================
// Constants
// ============================================================================

const EXPORT_VERSION = '1.0'
const FILENAME_CONVERSATIONS = 'conversations.jsonl'
const FILENAME_MESSAGES = 'messages.jsonl'
const FILENAME_MANIFEST = 'manifest.json'

// ============================================================================
// Types
// ============================================================================

export interface ExportOptions {
  /** Export type: full, incremental, or selected conversations */
  type?: 'full' | 'incremental' | 'selected'
  /** Specific conversation IDs (for 'selected' type) */
  conversationIds?: string[]
  /** Export changes since timestamp (for 'incremental' type) */
  since?: number
  /** Filter by platforms */
  platforms?: Platform[]
  /** Include soft-deleted records */
  includeDeleted?: boolean
}

export interface ExportResult {
  blob: Blob
  filename: string
  stats: {
    conversations: number
    messages: number
    sizeBytes: number
  }
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export data to a ZIP file containing JSONL files
 */
export async function exportData(options: ExportOptions = {}): Promise<ExportResult> {
  const { type = 'full', conversationIds, since, platforms, includeDeleted } = options

  // Get sync state for device ID
  let syncState = await getSyncState()
  if (!syncState) {
    syncState = await initializeSyncState()
  }

  // Fetch conversations based on export type
  let conversations = await getAllConversationsForExport({
    since: type === 'incremental' ? since : undefined,
    platforms,
    includeDeleted,
  })

  // Filter to selected conversations if specified
  if (type === 'selected' && conversationIds?.length) {
    const idSet = new Set(conversationIds)
    conversations = conversations.filter((c) => idSet.has(c.id))
  }

  // Fetch messages for these conversations
  const convIds = conversations.map((c) => c.id)
  const messages = await getAllMessagesForExport(convIds, { includeDeleted })

  // Generate JSONL content and checksums
  const conversationsJsonl = toJsonl(conversations)
  const messagesJsonl = toJsonl(messages)
  const [conversationsChecksum, messagesChecksum] = await Promise.all([
    sha256(conversationsJsonl),
    sha256(messagesJsonl),
  ])

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
    exportType: type === 'selected' ? 'full' : type,
    sinceTimestamp: type === 'incremental' ? (since ?? null) : null,
    encrypted: false,
  }

  // Create ZIP
  const zip = new JSZip()
  zip.file(FILENAME_MANIFEST, JSON.stringify(manifest, null, 2))
  zip.file(FILENAME_CONVERSATIONS, conversationsJsonl)
  zip.file(FILENAME_MESSAGES, messagesJsonl)

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  // Generate filename
  const dateStr = formatDateForFilename(new Date())
  const suffix = type === 'incremental' ? '_incremental' : type === 'selected' ? '_selected' : ''
  const filename = `chatcentral_export_${dateStr}${suffix}.zip`

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
 * Export specific conversations (convenience wrapper)
 */
export function exportConversations(
  conversationIds: string[],
  options: Pick<ExportOptions, 'includeDeleted'> = {}
): Promise<ExportResult> {
  return exportData({ type: 'selected', conversationIds, ...options })
}

/**
 * Download export result as a file
 */
export function downloadExport(result: ExportResult): void {
  downloadBlob(result.blob, result.filename)
}

// ============================================================================
// Simple JSON Export (for debugging)
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
  const data = {
    exportedAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    conversations: conversations.map((conv) => ({
      ...conv,
      messages: messagesByConversation.get(conv.id) || [],
    })),
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const filename = `chatcentral_export_${formatDateForFilename(new Date())}.json`

  return { blob, filename }
}
