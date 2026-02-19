import type { ExportManifestV2 } from './types'
import type { Platform } from '@/types'
import JSZip from 'jszip'
import {
  getAllConversationsForExport,
  getConversationById,
  getMessagesByConversationId,
} from '@/utils/db'
import { formatDateForFilename, generateSafeFilename, syncLogger } from './utils'
import { EXPORT_VERSION, FILENAME_MANIFEST } from './constants'
import { conversationToMarkdown } from './markdown'

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
 * Export data to a Markdown ZIP file.
 * Each conversation becomes a separate .md file with YAML frontmatter,
 * organized in platform/ subdirectories.
 */
export async function exportData(options: ExportOptions = {}): Promise<ExportResult> {
  const { type = 'full', conversationIds, since, platforms, includeDeleted } = options

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

  const exportedAt = Date.now()
  let totalMessages = 0

  // Create manifest
  const manifest: ExportManifestV2 = {
    version: EXPORT_VERSION,
    format: 'markdown',
    exportedAt,
    counts: {
      conversations: conversations.length,
      messages: 0, // Updated after building ZIP
    },
  }

  // Create ZIP with platform/ subdirectories, loading messages per conversation
  let blob: Blob
  try {
    const zip = new JSZip()

    // Track used filenames per platform to handle duplicates
    const usedFilenames = new Map<string, Set<string>>()

    for (const conv of conversations) {
      // Load messages per conversation to keep memory usage proportional to one conversation
      const messages = await getMessagesByConversationId(conv.id)
      totalMessages += messages.length

      const md = conversationToMarkdown(conv, messages, exportedAt)

      // Build path: platform/Title.md
      const platformDir = conv.platform
      if (!usedFilenames.has(platformDir)) {
        usedFilenames.set(platformDir, new Set())
      }
      const used = usedFilenames.get(platformDir)!

      const baseName = generateSafeFilename(conv.title, '', 80)
      let filename = `${baseName}.md`
      let counter = 1
      while (used.has(filename)) {
        filename = `${baseName}_${counter}.md`
        counter++
      }
      used.add(filename)

      zip.file(`${platformDir}/${filename}`, md)
    }

    // Write manifest with final message count
    manifest.counts.messages = totalMessages
    zip.file(FILENAME_MANIFEST, JSON.stringify(manifest, null, 2))

    blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
  } catch (error) {
    syncLogger.error('Failed to generate ZIP file', error)
    throw new Error(
      `Failed to generate export file: ${error instanceof Error ? error.message : 'unknown error'}`
    )
  }

  // Generate filename with metadata
  const dateStr = formatDateForFilename(new Date())
  const filename = `chatcentral_${conversations.length}conv_${totalMessages}msg_${dateStr}.zip`

  return {
    blob,
    filename,
    stats: {
      conversations: conversations.length,
      messages: totalMessages,
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

  // Load messages per conversation to avoid loading all into memory
  // Load messages per conversation to keep memory usage proportional to one conversation
  const conversationsWithMessages = []
  for (const conv of conversations) {
    const messages = await getMessagesByConversationId(conv.id)
    conversationsWithMessages.push({ ...conv, messages })
  }

  const data = {
    exportedAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    conversations: conversationsWithMessages,
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const filename = `chatcentral_export_${formatDateForFilename(new Date())}.json`

  return { blob, filename }
}

// ============================================================================
// Single Conversation Markdown Export
// ============================================================================

export interface MarkdownExportResult {
  content: string
  filename: string
  messageCount: number
}

/**
 * Export a single conversation to Markdown format (with YAML frontmatter)
 */
export async function exportToMarkdown(conversationId: string): Promise<MarkdownExportResult> {
  const conversation = await getConversationById(conversationId)
  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`)
  }

  const messages = await getMessagesByConversationId(conversationId)
  const content = conversationToMarkdown(conversation, messages)
  const filename = generateSafeFilename(conversation.title, '.md')

  return { content, filename, messageCount: messages.length }
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
