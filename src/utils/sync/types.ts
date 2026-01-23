import type { Conversation, Message, Platform } from '@/types'
import { z } from 'zod'

// ============================================================================
// Sync Field Extensions
// ============================================================================

/**
 * Sync-related fields added to Conversation and Message
 */
export interface SyncFields {
  /** Local version number, increments on each modification */
  syncVersion: number
  /** Last modification timestamp (local clock) */
  modifiedAt: number
  /** Last successful sync timestamp */
  syncedAt: number | null
  /** Has local unsynced changes */
  dirty: boolean
  /** Soft delete marker */
  deleted: boolean
  /** Deletion timestamp (for cleanup) */
  deletedAt: number | null
}

export type SyncableConversation = Conversation & SyncFields
export type SyncableMessage = Message & SyncFields

// ============================================================================
// Operation Log
// ============================================================================

export const operationTypeSchema = z.enum(['create', 'update', 'delete'])
export type OperationType = z.infer<typeof operationTypeSchema>

export const entityTypeSchema = z.enum(['conversation', 'message'])
export type EntityType = z.infer<typeof entityTypeSchema>

export const operationLogSchema = z.object({
  id: z.string(),
  entityType: entityTypeSchema,
  entityId: z.string(),
  operation: operationTypeSchema,
  changes: z.record(z.unknown()),
  timestamp: z.number(),
  synced: z.boolean(),
  syncedAt: z.number().nullable(),
})
export type OperationLog = z.infer<typeof operationLogSchema>

// ============================================================================
// Sync State
// ============================================================================

export const cloudSyncStatusSchema = z.enum(['disabled', 'idle', 'syncing', 'error', 'conflict'])
export type CloudSyncStatus = z.infer<typeof cloudSyncStatusSchema>

export const syncStateSchema = z.object({
  id: z.literal('global'),
  deviceId: z.string(),
  lastPullAt: z.number().nullable(),
  lastPushAt: z.number().nullable(),
  remoteCursor: z.string().nullable(),
  pendingConflicts: z.number(),
  status: cloudSyncStatusSchema,
  lastError: z.string().nullable(),
  lastErrorAt: z.number().nullable(),
})
export type SyncState = z.infer<typeof syncStateSchema>

// ============================================================================
// Conflict Record
// ============================================================================

export const conflictResolutionSchema = z.enum(['pending', 'local', 'remote', 'merged', 'auto'])
export type ConflictResolution = z.infer<typeof conflictResolutionSchema>

/** Simplified resolution type for UI actions */
export type ConflictResolutionAction = 'local' | 'remote' | 'merged'

export const conflictRecordSchema = z.object({
  id: z.string(),
  entityType: entityTypeSchema,
  entityId: z.string(),
  localVersion: z.record(z.unknown()),
  remoteVersion: z.record(z.unknown()),
  conflictFields: z.array(z.string()),
  resolution: conflictResolutionSchema,
  resolvedAt: z.number().nullable(),
  createdAt: z.number(),
})
export type ConflictRecord = z.infer<typeof conflictRecordSchema>

/**
 * UI-friendly conflict representation
 * Can be created from ConflictRecord for display
 */
export interface SyncConflict {
  id: string
  entityType: EntityType
  entityId: string
  localVersion?: SyncRecord | Record<string, unknown>
  remoteVersion?: SyncRecord | Record<string, unknown>
  field?: string // Most conflicting field (for summary)
  createdAt: number
}

/**
 * Convert ConflictRecord to UI-friendly SyncConflict
 */
export function toSyncConflict(record: ConflictRecord): SyncConflict {
  return {
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    localVersion: record.localVersion,
    remoteVersion: record.remoteVersion,
    field: record.conflictFields[0],
    createdAt: record.createdAt,
  }
}

// ============================================================================
// Merge Strategies
// ============================================================================

export type MergeStrategy =
  | 'lww' // Last-Write-Wins based on modifiedAt
  | 'or' // Boolean OR (any true = true)
  | 'and' // Boolean AND (all true = true)
  | 'union' // Array union
  | 'max' // Take maximum value
  | 'min' // Take minimum value

export interface MergeResult {
  merged: Record<string, unknown>
  conflicts: string[]
  needsUserResolution: boolean
}

// ============================================================================
// Export/Import Types
// ============================================================================

export const exportTypeSchema = z.enum(['full', 'incremental'])
export type ExportType = z.infer<typeof exportTypeSchema>

/** Zod schema for validating export manifest */
export const exportManifestSchema = z.object({
  version: z.string(),
  exportedAt: z.number(),
  deviceId: z.string(),
  counts: z.object({
    conversations: z.number(),
    messages: z.number(),
  }),
  checksums: z.object({
    'conversations.jsonl': z.string(),
    'messages.jsonl': z.string(),
  }),
  exportType: exportTypeSchema,
  sinceTimestamp: z.number().nullable(),
  encrypted: z.boolean(),
})

export type ExportManifest = z.infer<typeof exportManifestSchema>

export interface ExportOptionsSync {
  type: ExportType
  since?: number
  platforms?: Platform[]
  includeDeleted?: boolean
}

export interface ImportOptions {
  conflictStrategy: 'skip' | 'overwrite' | 'merge'
}

export interface ImportResult {
  success: boolean
  imported: { conversations: number; messages: number }
  skipped: { conversations: number; messages: number }
  conflicts: ConflictRecord[]
  errors: ImportError[]
}

export interface ImportError {
  type: 'parse_error' | 'validation_error' | 'checksum_mismatch' | 'version_incompatible'
  message: string
  line?: number
}

/** Import status for a single entity */
export type ImportStatus = 'imported' | 'skipped' | 'conflict'

/** Entity type for import stats */
export type ImportEntityType = 'conversations' | 'messages'

/**
 * Create an empty ImportResult object
 */
export function createEmptyImportResult(): ImportResult {
  return {
    success: true,
    imported: { conversations: 0, messages: 0 },
    skipped: { conversations: 0, messages: 0 },
    conflicts: [],
    errors: [],
  }
}

/**
 * Update import stats based on import status
 */
export function updateImportStats(
  result: ImportResult,
  status: ImportStatus,
  entityType: ImportEntityType
): void {
  if (status === 'imported') {
    result.imported[entityType]++
  } else if (status === 'skipped') {
    result.skipped[entityType]++
  }
  // 'conflict' status doesn't increment counters (handled separately)
}

// ============================================================================
// Sync Provider Types
// ============================================================================

export interface SyncRecord {
  id: string
  entityType: EntityType
  data: Record<string, unknown>
  syncVersion: number
  modifiedAt: number
  deleted: boolean
}

export interface PullResult {
  success: boolean
  records: SyncRecord[]
  cursor: string | null
  hasMore: boolean
  error?: SyncError
}

export interface PushResult {
  success: boolean
  applied: string[]
  failed: FailedRecord[]
  error?: SyncError
}

export interface FailedRecord {
  id: string
  reason: 'conflict' | 'validation' | 'not_found' | 'server_error'
  message: string
  serverVersion?: SyncRecord
}

export type SyncErrorCode =
  | 'network_error'
  | 'auth_failed'
  | 'server_error'
  | 'conflict'
  | 'quota_exceeded'
  | 'version_mismatch'
  | 'checksum_mismatch'
  | 'encryption_error'

export interface SyncError {
  code: SyncErrorCode
  message: string
  recoverable: boolean
  retryAfter?: number
  details?: unknown
}

// ============================================================================
// Sync Provider Interface
// ============================================================================

export interface ProviderConfig {
  type: 'rest' | 'file'
  endpoint?: string
  apiKey?: string
}

export interface SyncProvider {
  readonly name: string
  readonly type: 'rest' | 'file'

  connect: (config: ProviderConfig) => Promise<void>
  disconnect: () => Promise<void>
  isConnected: () => boolean

  pull: (cursor?: string | null) => Promise<PullResult>
  push: (changes: SyncRecord[]) => Promise<PushResult>
}
