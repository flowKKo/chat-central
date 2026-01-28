import {
  type ConflictRecord,
  type ExportManifest,
  type ImportError,
  type ImportOptions,
  type ImportResult,
  type ImportStatus,
  createEmptyImportResult,
  exportManifestSchema,
  updateImportStats,
} from './types'
import type { Conversation, Message } from '@/types'
import JSZip from 'jszip'
import { conversationSchema, messageSchema } from '@/types'
import { addConflict, db } from '@/utils/db'
import { mergeConversation, mergeMessage } from './merge'
import { parseJsonl, sha256, syncLogger } from './utils'
import {
  FILENAME_CONVERSATIONS,
  FILENAME_MANIFEST,
  FILENAME_MESSAGES,
  SUPPORTED_VERSIONS,
} from './constants'

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import data from a ZIP file
 */
export async function importData(
  file: File,
  options: ImportOptions = { conflictStrategy: 'merge' }
): Promise<ImportResult> {
  const result = createEmptyImportResult()

  try {
    // Load and parse ZIP
    const zip = await JSZip.loadAsync(file)

    // Read and validate manifest
    const manifestFile = zip.file(FILENAME_MANIFEST)
    if (!manifestFile) {
      result.errors.push({
        type: 'parse_error',
        message: 'Missing manifest.json in archive',
      })
      result.success = false
      return result
    }

    const manifestRaw = await manifestFile.async('string')

    // Validate manifest with Zod schema
    let manifest: ExportManifest
    try {
      const parsed = JSON.parse(manifestRaw)
      const validated = exportManifestSchema.safeParse(parsed)
      if (!validated.success) {
        result.errors.push({
          type: 'validation_error',
          message: `Invalid manifest format: ${validated.error.message}`,
        })
        result.success = false
        return result
      }
      manifest = validated.data
    } catch {
      result.errors.push({
        type: 'parse_error',
        message: 'Failed to parse manifest.json',
      })
      result.success = false
      return result
    }

    // Validate version
    if (!(SUPPORTED_VERSIONS as readonly string[]).includes(manifest.version)) {
      result.errors.push({
        type: 'version_incompatible',
        message: `Unsupported export version: ${manifest.version}. Supported: ${SUPPORTED_VERSIONS.join(', ')}`,
      })
      result.success = false
      return result
    }

    // Read data files
    const conversationsFile = zip.file(FILENAME_CONVERSATIONS)
    const messagesFile = zip.file(FILENAME_MESSAGES)

    if (!conversationsFile || !messagesFile) {
      result.errors.push({
        type: 'parse_error',
        message: 'Missing data files in archive',
      })
      result.success = false
      return result
    }

    const conversationsRaw = await conversationsFile.async('string')
    const messagesRaw = await messagesFile.async('string')

    // Validate checksums
    const conversationsChecksum = await sha256(conversationsRaw)
    const messagesChecksum = await sha256(messagesRaw)

    if (conversationsChecksum !== manifest.checksums[FILENAME_CONVERSATIONS]) {
      result.errors.push({
        type: 'checksum_mismatch',
        message: 'Conversations file checksum mismatch - file may be corrupted',
      })
      result.success = false
      return result
    }

    if (messagesChecksum !== manifest.checksums[FILENAME_MESSAGES]) {
      result.errors.push({
        type: 'checksum_mismatch',
        message: 'Messages file checksum mismatch - file may be corrupted',
      })
      result.success = false
      return result
    }

    // Parse JSONL files
    const conversations = parseJsonl<Conversation>(
      conversationsRaw,
      conversationSchema,
      (line, msg) =>
        result.errors.push({ type: 'parse_error', message: `Line ${line}: ${msg}`, line })
    )
    const messages = parseJsonl<Message>(messagesRaw, messageSchema, (line, msg) =>
      result.errors.push({ type: 'parse_error', message: `Line ${line}: ${msg}`, line })
    )

    // Import within a transaction
    await db.transaction('rw', [db.conversations, db.messages, db.conflicts], async () => {
      // Import conversations
      for (const conv of conversations) {
        const status = await importConversation(conv, options, result)
        updateImportStats(result, status, 'conversations')
      }

      // Import messages
      for (const msg of messages) {
        const status = await importMessage(msg, options, result)
        updateImportStats(result, status, 'messages')
      }
    })

    return result
  } catch (error) {
    result.success = false
    result.errors.push({
      type: 'parse_error',
      message: error instanceof Error ? error.message : 'Unknown error during import',
    })
    return result
  }
}

// ============================================================================
// Generic Import Entity
// ============================================================================

interface ImportTable<T> {
  get: (id: string) => Promise<T | undefined>
  add: (item: T) => Promise<unknown>
  put: (item: T) => Promise<unknown>
}

interface ImportMergeResult<T> {
  merged: T
  conflicts: string[]
  needsUserResolution: boolean
}

type EntityType = 'conversation' | 'message'

/**
 * Generic import function for entities
 */
async function importEntity<T extends { id: string }>(
  record: T,
  entityType: EntityType,
  table: ImportTable<T>,
  mergeFn: (existing: T, record: T) => ImportMergeResult<T>,
  options: ImportOptions,
  result: ImportResult
): Promise<ImportStatus> {
  const existing = await table.get(record.id)

  if (!existing) {
    await table.add({ ...record, dirty: false, syncedAt: Date.now() } as T)
    return 'imported'
  }

  switch (options.conflictStrategy) {
    case 'skip':
      return 'skipped'

    case 'overwrite':
      await table.put({ ...record, dirty: false, syncedAt: Date.now() } as T)
      return 'imported'

    case 'merge': {
      const mergeResult = mergeFn(existing, record)

      if (mergeResult.needsUserResolution) {
        const conflict: Omit<ConflictRecord, 'id' | 'createdAt'> = {
          entityType,
          entityId: record.id,
          localVersion: existing as unknown as Record<string, unknown>,
          remoteVersion: record as unknown as Record<string, unknown>,
          conflictFields: mergeResult.conflicts,
          resolution: 'pending',
          resolvedAt: null,
        }
        await addConflict(conflict)
        result.conflicts.push({ ...conflict, id: '', createdAt: Date.now() })
        return 'conflict'
      }

      await table.put({ ...mergeResult.merged, dirty: false, syncedAt: Date.now() } as T)
      return 'imported'
    }

    default:
      return 'skipped'
  }
}

/** Import a single conversation */
function importConversation(record: Conversation, options: ImportOptions, result: ImportResult) {
  return importEntity(
    record,
    'conversation',
    db.conversations as ImportTable<Conversation>,
    (existing, rec) => {
      const r = mergeConversation(existing, rec)
      return {
        merged: r.conversation,
        conflicts: r.conflicts,
        needsUserResolution: r.needsUserResolution,
      }
    },
    options,
    result
  )
}

/** Import a single message */
function importMessage(record: Message, options: ImportOptions, result: ImportResult) {
  return importEntity(
    record,
    'message',
    db.messages as ImportTable<Message>,
    (existing, rec) => {
      const r = mergeMessage(existing, rec)
      return {
        merged: r.message,
        conflicts: r.conflicts,
        needsUserResolution: r.needsUserResolution,
      }
    },
    options,
    result
  )
}

// ============================================================================
// Import from Simple JSON
// ============================================================================

interface SimpleExportFormat {
  exportedAt: string
  version: string
  conversations: Array<Conversation & { messages?: Message[] }>
}

/**
 * Import from a simple JSON file
 */
export async function importFromJson(
  file: File,
  options: ImportOptions = { conflictStrategy: 'merge' }
): Promise<ImportResult> {
  const result = createEmptyImportResult()

  try {
    const text = await file.text()
    const data = JSON.parse(text) as SimpleExportFormat

    await db.transaction('rw', [db.conversations, db.messages, db.conflicts], async () => {
      for (const convWithMessages of data.conversations) {
        const { messages, ...conv } = convWithMessages

        // Import conversation
        const convStatus = await importConversation(conv, options, result)
        updateImportStats(result, convStatus, 'conversations')

        // Import messages
        if (messages) {
          for (const msg of messages) {
            const msgStatus = await importMessage(msg, options, result)
            updateImportStats(result, msgStatus, 'messages')
          }
        }
      }
    })

    return result
  } catch (error) {
    syncLogger.error('Failed to import JSON file', error)
    result.success = false
    result.errors.push({
      type: 'parse_error',
      message: error instanceof Error ? error.message : 'Unknown error during import',
    })
    return result
  }
}

// ============================================================================
// File Validation
// ============================================================================

/**
 * Validate an import file without actually importing
 */
export async function validateImportFile(file: File): Promise<{
  valid: boolean
  manifest?: ExportManifest
  errors: ImportError[]
}> {
  const errors: ImportError[] = []

  try {
    // Check file extension
    if (!file.name.endsWith('.zip') && !file.name.endsWith('.json')) {
      errors.push({
        type: 'parse_error',
        message: 'File must be a .zip or .json file',
      })
      return { valid: false, errors }
    }

    if (file.name.endsWith('.json')) {
      // Validate JSON format
      const text = await file.text()
      const data = JSON.parse(text) as SimpleExportFormat
      if (!data.conversations || !Array.isArray(data.conversations)) {
        errors.push({
          type: 'validation_error',
          message: 'Invalid JSON format: missing conversations array',
        })
        return { valid: false, errors }
      }
      return {
        valid: true,
        manifest: {
          version: data.version || '1.0',
          exportedAt: new Date(data.exportedAt).getTime() || Date.now(),
          deviceId: 'unknown',
          counts: {
            conversations: data.conversations.length,
            messages: data.conversations.reduce((sum, c) => sum + (c.messages?.length || 0), 0),
          },
          checksums: { 'conversations.jsonl': '', 'messages.jsonl': '' },
          exportType: 'full',
          sinceTimestamp: null,
          encrypted: false,
        },
        errors,
      }
    }

    // Validate ZIP format
    const zip = await JSZip.loadAsync(file)

    const manifestFile = zip.file(FILENAME_MANIFEST)
    if (!manifestFile) {
      errors.push({
        type: 'parse_error',
        message: 'Missing manifest.json in archive',
      })
      return { valid: false, errors }
    }

    const manifestRaw = await manifestFile.async('string')
    const manifest = JSON.parse(manifestRaw) as ExportManifest

    if (!(SUPPORTED_VERSIONS as readonly string[]).includes(manifest.version)) {
      errors.push({
        type: 'version_incompatible',
        message: `Unsupported export version: ${manifest.version}`,
      })
      return { valid: false, errors }
    }

    if (!zip.file(FILENAME_CONVERSATIONS) || !zip.file(FILENAME_MESSAGES)) {
      errors.push({
        type: 'parse_error',
        message: 'Missing data files in archive',
      })
      return { valid: false, errors }
    }

    return { valid: true, manifest, errors }
  } catch (error) {
    errors.push({
      type: 'parse_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return { valid: false, errors }
  }
}
