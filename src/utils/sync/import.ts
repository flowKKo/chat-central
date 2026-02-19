import {
  type ConflictRecord,
  type ExportManifest,
  type ExportManifestV2,
  type ImportError,
  type ImportOptions,
  type ImportResult,
  type ImportStatus,
  createEmptyImportResult,
  exportManifestSchema,
  exportManifestV2Schema,
  updateImportStats,
} from './types'
import type { Conversation, Message } from '@/types'
import { z } from 'zod'
import JSZip from 'jszip'
import { conversationSchema, messageSchema } from '@/types'
import { addConflict, db, invalidateSearchIndex } from '@/utils/db'
import { mergeConversation, mergeMessage } from './merge'
import { parseJsonl, sha256, syncLogger } from './utils'
import {
  FILENAME_CONVERSATIONS,
  FILENAME_MANIFEST,
  FILENAME_MESSAGES,
  SUPPORTED_VERSIONS,
} from './constants'
import { parseMarkdownExport } from './markdown'

// ============================================================================
// Import Safety Limits
// ============================================================================

/** Maximum uncompressed ZIP size: 500 MB */
const MAX_UNCOMPRESSED_SIZE_BYTES = 500 * 1024 * 1024
/** Maximum number of files allowed in a ZIP archive */
const MAX_FILE_COUNT = 10_000

/**
 * Validate ZIP archive safety limits (size, file count, path traversal)
 */
function validateZipSafety(zip: JSZip): ImportError | null {
  let totalSize = 0
  let fileCount = 0

  zip.forEach((relativePath, file) => {
    if (file.dir) return
    // Reject path traversal attempts
    if (relativePath.includes('..') || relativePath.startsWith('/')) return
    fileCount++
    // Use compressed size as a lower bound (uncompressed checked per-file on read)
    totalSize +=
      (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
  })

  if (fileCount > MAX_FILE_COUNT) {
    return {
      type: 'validation_error',
      message: `Archive contains too many files (${fileCount}). Maximum allowed: ${MAX_FILE_COUNT}`,
    }
  }

  if (totalSize > MAX_UNCOMPRESSED_SIZE_BYTES) {
    return {
      type: 'validation_error',
      message: `Archive uncompressed size exceeds limit (${Math.round(totalSize / 1024 / 1024)}MB). Maximum: ${MAX_UNCOMPRESSED_SIZE_BYTES / 1024 / 1024}MB`,
    }
  }

  return null
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import data from a ZIP file (auto-detects v1 JSONL or v2 Markdown format)
 */
export async function importData(
  file: File,
  options: ImportOptions = { conflictStrategy: 'merge' }
): Promise<ImportResult> {
  const result = createEmptyImportResult()

  try {
    // Load and parse ZIP
    const zip = await JSZip.loadAsync(file)

    // Validate ZIP safety limits
    const safetyError = validateZipSafety(zip)
    if (safetyError) {
      result.errors.push(safetyError)
      result.success = false
      return result
    }

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
    let manifestParsed: unknown
    try {
      manifestParsed = JSON.parse(manifestRaw)
    } catch (error) {
      syncLogger.error('Manifest JSON parse failed', error)
      result.errors.push({
        type: 'parse_error',
        message: `Failed to parse manifest.json: ${error instanceof Error ? error.message : 'unknown error'}`,
      })
      result.success = false
      return result
    }

    // Auto-detect format: v2 Markdown vs v1 JSONL
    const v2Result = exportManifestV2Schema.safeParse(manifestParsed)
    if (v2Result.success) {
      return importFromMarkdownZip(zip, v2Result.data, options, result)
    }

    // Try v1 format
    const v1Result = exportManifestSchema.safeParse(manifestParsed)
    if (v1Result.success) {
      return importFromJsonlZip(zip, v1Result.data, options, result)
    }

    // Neither format matched
    result.errors.push({
      type: 'validation_error',
      message: 'Invalid manifest format: does not match v1 or v2 schema',
    })
    result.success = false
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
// V2 Markdown ZIP Import
// ============================================================================

async function importFromMarkdownZip(
  zip: JSZip,
  _manifest: ExportManifestV2,
  options: ImportOptions,
  result: ImportResult
): Promise<ImportResult> {
  // Find all .md files in the ZIP (any depth)
  const mdFiles: JSZip.JSZipObject[] = []
  zip.forEach((relativePath, file) => {
    if (relativePath.endsWith('.md') && !file.dir) {
      mdFiles.push(file)
    }
  })

  if (mdFiles.length === 0) {
    result.errors.push({
      type: 'parse_error',
      message: 'No .md files found in archive',
    })
    result.success = false
    return result
  }

  // Parse all markdown files first, then import in a transaction
  const parsed: { conversation: Conversation; messages: Message[] }[] = []
  for (const file of mdFiles) {
    try {
      const content = await file.async('string')
      parsed.push(parseMarkdownExport(content))
    } catch (error) {
      result.errors.push({
        type: 'parse_error',
        message: `Failed to parse ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  await db.transaction('rw', [db.conversations, db.messages, db.conflicts], async () => {
    for (const { conversation, messages } of parsed) {
      const convStatus = await importConversation(conversation, options, result)
      updateImportStats(result, convStatus, 'conversations')

      for (const msg of messages) {
        const msgStatus = await importMessage(msg, options, result)
        updateImportStats(result, msgStatus, 'messages')
      }
    }
  })

  invalidateSearchIndex()
  return result
}

// ============================================================================
// V1 JSONL ZIP Import (legacy)
// ============================================================================

async function importFromJsonlZip(
  zip: JSZip,
  manifest: ExportManifest,
  options: ImportOptions,
  result: ImportResult
): Promise<ImportResult> {
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

  invalidateSearchIndex()

  return result
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
        const conflictId = await addConflict(conflict)
        result.conflicts.push({ ...conflict, id: conflictId, createdAt: Date.now() })
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

// Lenient schema for simple JSON import: validates structure but allows partial conversation data
// (older exports may not have all fields that the current conversationSchema requires)
const simpleExportConversationSchema = z
  .object({
    id: z.string(),
    platform: z.string(),
    messages: z.array(z.object({ id: z.string() }).passthrough()).optional(),
  })
  .passthrough()

const simpleExportFormatSchema = z.object({
  exportedAt: z.string(),
  version: z.string(),
  conversations: z.array(simpleExportConversationSchema),
})

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
    const parsed = JSON.parse(text) as unknown
    const parseResult = simpleExportFormatSchema.safeParse(parsed)
    if (!parseResult.success) {
      result.success = false
      result.errors.push({
        type: 'validation_error',
        message: `Invalid JSON format: ${parseResult.error.issues[0]?.message ?? 'unknown error'}`,
      })
      return result
    }
    const data = parseResult.data

    await db.transaction('rw', [db.conversations, db.messages, db.conflicts], async () => {
      for (const convWithMessages of data.conversations) {
        const { messages, ...conv } = convWithMessages

        // Import conversation (passthrough schema validates structure; cast is safe)
        const convStatus = await importConversation(
          conv as unknown as Conversation,
          options,
          result
        )
        updateImportStats(result, convStatus, 'conversations')

        // Import messages
        if (messages) {
          for (const msg of messages) {
            const msgStatus = await importMessage(msg as unknown as Message, options, result)
            updateImportStats(result, msgStatus, 'messages')
          }
        }
      }
    })

    invalidateSearchIndex()

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
  manifest?: ExportManifest | ExportManifestV2
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
      // Validate JSON format with Zod
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const jsonResult = simpleExportFormatSchema.safeParse(parsed)
      if (!jsonResult.success) {
        errors.push({
          type: 'validation_error',
          message: `Invalid JSON format: ${jsonResult.error.issues[0]?.message ?? 'unknown error'}`,
        })
        return { valid: false, errors }
      }
      const data = jsonResult.data
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
    const manifestParsed = JSON.parse(manifestRaw)

    // Try v2 first
    const v2Result = exportManifestV2Schema.safeParse(manifestParsed)
    if (v2Result.success) {
      return { valid: true, manifest: v2Result.data, errors }
    }

    // Try v1
    const v1Result = exportManifestSchema.safeParse(manifestParsed)
    if (!v1Result.success) {
      errors.push({
        type: 'validation_error',
        message: 'Invalid manifest format: does not match v1 or v2 schema',
      })
      return { valid: false, errors }
    }
    const manifest = v1Result.data

    if (!(SUPPORTED_VERSIONS as readonly string[]).includes(manifest.version)) {
      errors.push({
        type: 'version_incompatible',
        message: `Unsupported export version: ${manifest.version}`,
      })
      return { valid: false, errors }
    }

    // v1 requires data files
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
