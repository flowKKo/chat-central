import JSZip from 'jszip'
import type { Conversation, Message } from '@/types'
import { conversationSchema, messageSchema } from '@/types'
import { db, addConflict } from '@/utils/db'
import type {
  ExportManifest,
  ImportOptions,
  ImportResult,
  ImportError,
  ConflictRecord,
} from './types'
import { mergeConversation, mergeMessage } from './merge'
import { sha256, parseJsonl } from './utils'

// ============================================================================
// Constants
// ============================================================================

const SUPPORTED_VERSIONS = ['1.0']
const FILENAME_CONVERSATIONS = 'conversations.jsonl'
const FILENAME_MESSAGES = 'messages.jsonl'
const FILENAME_MANIFEST = 'manifest.json'

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
  const result: ImportResult = {
    success: true,
    imported: { conversations: 0, messages: 0 },
    skipped: { conversations: 0, messages: 0 },
    conflicts: [],
    errors: [],
  }

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
    const manifest = JSON.parse(manifestRaw) as ExportManifest

    // Validate version
    if (!SUPPORTED_VERSIONS.includes(manifest.version)) {
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
      (line, msg) => result.errors.push({ type: 'parse_error', message: `Line ${line}: ${msg}`, line })
    )
    const messages = parseJsonl<Message>(
      messagesRaw,
      messageSchema,
      (line, msg) => result.errors.push({ type: 'parse_error', message: `Line ${line}: ${msg}`, line })
    )

    // Import within a transaction
    await db.transaction('rw', [db.conversations, db.messages, db.conflicts], async () => {
      // Import conversations
      for (const conv of conversations) {
        const importStatus = await importConversation(conv, options, result)
        if (importStatus === 'imported') {
          result.imported.conversations++
        } else if (importStatus === 'skipped') {
          result.skipped.conversations++
        }
      }

      // Import messages
      for (const msg of messages) {
        const importStatus = await importMessage(msg, options, result)
        if (importStatus === 'imported') {
          result.imported.messages++
        } else if (importStatus === 'skipped') {
          result.skipped.messages++
        }
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

/**
 * Import a single conversation
 */
async function importConversation(
  record: Conversation,
  options: ImportOptions,
  result: ImportResult
): Promise<'imported' | 'skipped' | 'conflict'> {
  const existing = await db.conversations.get(record.id)

  if (!existing) {
    // New record - import directly
    await db.conversations.add({
      ...record,
      dirty: false,
      syncedAt: Date.now(),
    })
    return 'imported'
  }

  switch (options.conflictStrategy) {
    case 'skip':
      return 'skipped'

    case 'overwrite':
      await db.conversations.put({
        ...record,
        dirty: false,
        syncedAt: Date.now(),
      })
      return 'imported'

    case 'merge': {
      const mergeResult = mergeConversation(existing, record)

      if (mergeResult.needsUserResolution) {
        // Save conflict for later resolution
        const conflict: Omit<ConflictRecord, 'id' | 'createdAt'> = {
          entityType: 'conversation',
          entityId: record.id,
          localVersion: existing as unknown as Record<string, unknown>,
          remoteVersion: record as unknown as Record<string, unknown>,
          conflictFields: mergeResult.conflicts,
          resolution: 'pending',
          resolvedAt: null,
        }
        await addConflict(conflict)
        result.conflicts.push({
          ...conflict,
          id: '', // Will be assigned by addConflict
          createdAt: Date.now(),
        })
        return 'conflict'
      }

      // Auto-merge successful
      await db.conversations.put({
        ...mergeResult.conversation,
        dirty: false,
        syncedAt: Date.now(),
      })
      return 'imported'
    }

    default:
      return 'skipped'
  }
}

/**
 * Import a single message
 */
async function importMessage(
  record: Message,
  options: ImportOptions,
  result: ImportResult
): Promise<'imported' | 'skipped' | 'conflict'> {
  const existing = await db.messages.get(record.id)

  if (!existing) {
    // New record - import directly
    await db.messages.add({
      ...record,
      dirty: false,
      syncedAt: Date.now(),
    })
    return 'imported'
  }

  switch (options.conflictStrategy) {
    case 'skip':
      return 'skipped'

    case 'overwrite':
      await db.messages.put({
        ...record,
        dirty: false,
        syncedAt: Date.now(),
      })
      return 'imported'

    case 'merge': {
      const mergeResult = mergeMessage(existing, record)

      if (mergeResult.needsUserResolution) {
        // Save conflict for later resolution
        const conflict: Omit<ConflictRecord, 'id' | 'createdAt'> = {
          entityType: 'message',
          entityId: record.id,
          localVersion: existing as unknown as Record<string, unknown>,
          remoteVersion: record as unknown as Record<string, unknown>,
          conflictFields: mergeResult.conflicts,
          resolution: 'pending',
          resolvedAt: null,
        }
        await addConflict(conflict)
        result.conflicts.push({
          ...conflict,
          id: '',
          createdAt: Date.now(),
        })
        return 'conflict'
      }

      // Auto-merge successful
      await db.messages.put({
        ...mergeResult.message,
        dirty: false,
        syncedAt: Date.now(),
      })
      return 'imported'
    }

    default:
      return 'skipped'
  }
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
  const result: ImportResult = {
    success: true,
    imported: { conversations: 0, messages: 0 },
    skipped: { conversations: 0, messages: 0 },
    conflicts: [],
    errors: [],
  }

  try {
    const text = await file.text()
    const data = JSON.parse(text) as SimpleExportFormat

    await db.transaction('rw', [db.conversations, db.messages, db.conflicts], async () => {
      for (const convWithMessages of data.conversations) {
        const { messages, ...conv } = convWithMessages

        // Import conversation
        const convStatus = await importConversation(conv, options, result)
        if (convStatus === 'imported') {
          result.imported.conversations++
        } else if (convStatus === 'skipped') {
          result.skipped.conversations++
        }

        // Import messages
        if (messages) {
          for (const msg of messages) {
            const msgStatus = await importMessage(msg, options, result)
            if (msgStatus === 'imported') {
              result.imported.messages++
            } else if (msgStatus === 'skipped') {
              result.skipped.messages++
            }
          }
        }
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
            messages: data.conversations.reduce(
              (sum, c) => sum + (c.messages?.length || 0),
              0
            ),
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

    if (!SUPPORTED_VERSIONS.includes(manifest.version)) {
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
