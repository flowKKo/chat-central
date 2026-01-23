import type { ExportManifest } from './types'
import type { Message, Platform } from '@/types'
import JSZip from 'jszip'
import { PLATFORM_CONFIG } from '@/types'
import {
  getAllConversationsForExport,
  getAllMessagesForExport,
  getConversationById,
  getMessagesByConversationId,
  getSyncState,
  initializeSyncState,
} from '@/utils/db'
import {
  downloadBlob,
  formatDateForFilename,
  generateSafeFilename,
  sha256,
  syncLogger,
  toJsonl,
} from './utils'

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

  // Create ZIP with error handling
  let blob: Blob
  try {
    const zip = new JSZip()
    zip.file(FILENAME_MANIFEST, JSON.stringify(manifest, null, 2))
    zip.file(FILENAME_CONVERSATIONS, conversationsJsonl)
    zip.file(FILENAME_MESSAGES, messagesJsonl)

    blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
  } catch (error) {
    syncLogger.error('Failed to generate ZIP file', error)
    throw new Error('Failed to generate export file. Please try again.')
  }

  // Generate filename with metadata
  const dateStr = formatDateForFilename(new Date())
  const suffix = type === 'incremental' ? '_incremental' : type === 'selected' ? '_selected' : ''
  const filename = `chatcentral_${conversations.length}conv_${messages.length}msg_${dateStr}${suffix}.zip`

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
export async function exportToJson(
  options: {
    platforms?: Platform[]
    includeDeleted?: boolean
  } = {}
): Promise<SimpleExportResult> {
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

// ============================================================================
// Markdown Export
// ============================================================================

export interface MarkdownExportResult {
  content: string
  filename: string
}

/**
 * Export a single conversation to Markdown format
 */
export async function exportToMarkdown(conversationId: string): Promise<MarkdownExportResult> {
  const conversation = await getConversationById(conversationId)
  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`)
  }

  const messages = await getMessagesByConversationId(conversationId)
  const platformConfig = PLATFORM_CONFIG[conversation.platform]

  const lines: string[] = []

  // Header
  lines.push(`# ${conversation.title}`)
  lines.push('')
  lines.push(`**Platform**: ${platformConfig.name}`)
  lines.push(`**Created**: ${new Date(conversation.createdAt).toLocaleDateString()}`)
  lines.push(`**Messages**: ${messages.length}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Messages
  for (const message of messages) {
    const role = message.role === 'user' ? 'User' : 'Assistant'
    lines.push(`## ${role}`)
    lines.push('')
    lines.push(message.content)
    lines.push('')
  }

  const content = lines.join('\n')
  const filename = generateSafeFilename(conversation.title, '.md')

  return { content, filename }
}

/**
 * Export a conversation to JSON format (single conversation)
 */
export async function exportConversationToJson(
  conversationId: string
): Promise<{ content: string; filename: string }> {
  const conversation = await getConversationById(conversationId)
  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`)
  }

  const messages = await getMessagesByConversationId(conversationId)

  const data = {
    exportedAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    conversation: {
      ...conversation,
      messages,
    },
  }

  const content = JSON.stringify(data, null, 2)
  const filename = generateSafeFilename(conversation.title, '.json')

  return { content, filename }
}

// ============================================================================
// Batch Markdown Export
// ============================================================================

export interface BatchMarkdownExportResult {
  blob: Blob
  filename: string
  stats: {
    conversations: number
    totalMessages: number
    sizeBytes: number
  }
}

/**
 * Export multiple conversations to Markdown files in a ZIP archive
 * Each conversation becomes a separate .md file
 */
export async function exportBatchMarkdown(
  conversationIds: string[]
): Promise<BatchMarkdownExportResult> {
  const zip = new JSZip()
  let totalMessages = 0
  const usedFilenames = new Set<string>()

  for (const id of conversationIds) {
    try {
      const result = await exportToMarkdown(id)

      // Ensure unique filename in case of duplicates
      let filename = result.filename
      let counter = 1
      while (usedFilenames.has(filename)) {
        const baseName = result.filename.replace('.md', '')
        filename = `${baseName}_${counter}.md`
        counter++
      }
      usedFilenames.add(filename)

      zip.file(filename, result.content)

      // Count messages from content (count ## User and ## Assistant headers)
      const messageCount = (result.content.match(/^## (User|Assistant)$/gm) || []).length
      totalMessages += messageCount
    } catch (error) {
      syncLogger.warn(`Failed to export conversation ${id}: ${String(error)}`)
    }
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const dateStr = formatDateForFilename(new Date())
  const filename = `chatcentral_${conversationIds.length}conv_markdown_${dateStr}.zip`

  return {
    blob,
    filename,
    stats: {
      conversations: conversationIds.length,
      totalMessages,
      sizeBytes: blob.size,
    },
  }
}
