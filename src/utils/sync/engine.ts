import type {
  ConflictRecord,
  EntityType,
  PullResult,
  SyncError,
  SyncProvider,
  SyncRecord,
} from './types'
import { mergeConversation, mergeMessage } from './merge'
import type { Conversation, Message } from '@/types'
import {
  db,
  getDirtyConversations,
  getDirtyMessages,
  clearDirtyFlags,
  addConflict,
  updateSyncState,
  getSyncState,
  getPendingOperations,
  markOperationsSynced,
} from '@/utils/db'

// ============================================================================
// Types
// ============================================================================

export interface SyncCycleResult {
  success: boolean
  pulled: {
    conversations: number
    messages: number
  }
  pushed: {
    conversations: number
    messages: number
  }
  conflicts: ConflictRecord[]
  errors: SyncError[]
}

export interface SyncEngineOptions {
  /** Batch size for push operations */
  pushBatchSize?: number
  /** Whether to auto-resolve conflicts */
  autoResolveConflicts?: boolean
}

// ============================================================================
// Sync Engine
// ============================================================================

/**
 * Execute a full sync cycle: Pull -> Merge -> Push
 */
export async function syncCycle(
  provider: SyncProvider,
  options: SyncEngineOptions = {},
): Promise<SyncCycleResult> {
  const { pushBatchSize = 50, autoResolveConflicts = true } = options

  const result: SyncCycleResult = {
    success: true,
    pulled: { conversations: 0, messages: 0 },
    pushed: { conversations: 0, messages: 0 },
    conflicts: [],
    errors: [],
  }

  try {
    // Update sync state to syncing
    await updateSyncState({ status: 'syncing', lastError: null })

    // Get current sync state
    const syncState = await getSyncState()
    const cursor = syncState?.remoteCursor ?? null

    // ========== PULL ==========
    const pullResult = await pullChanges(provider, cursor)

    if (!pullResult.success && pullResult.error) {
      result.errors.push(pullResult.error)
      result.success = false
      await updateSyncState({
        status: 'error',
        lastError: pullResult.error.message,
        lastErrorAt: Date.now(),
      })
      return result
    }

    // ========== MERGE ==========
    const mergeResult = await mergeRemoteChanges(pullResult.records, autoResolveConflicts)

    result.pulled = mergeResult.applied
    result.conflicts.push(...mergeResult.conflicts)

    // Update cursor after successful pull
    if (pullResult.cursor) {
      await updateSyncState({
        remoteCursor: pullResult.cursor,
        lastPullAt: Date.now(),
      })
    }

    // ========== PUSH ==========
    const pushResult = await pushChanges(provider, pushBatchSize)

    if (!pushResult.success && pushResult.error) {
      result.errors.push(pushResult.error)
      // Don't fail the whole sync if push fails - pull was successful
    }

    result.pushed = pushResult.counts

    // Handle push failures
    if (pushResult.failed.length > 0) {
      for (const failed of pushResult.failed) {
        if (failed.reason === 'conflict' && failed.serverVersion) {
          // Re-merge with server version
          const conflict = await handlePushConflict(failed.serverVersion, autoResolveConflicts)
          if (conflict) {
            result.conflicts.push(conflict)
          }
        }
      }
    }

    // Update sync state
    const finalStatus = result.conflicts.length > 0 ? 'conflict' : 'idle'
    await updateSyncState({
      status: finalStatus,
      lastPushAt: Date.now(),
      pendingConflicts: result.conflicts.filter((c) => c.resolution === 'pending').length,
    })

    return result
  }
  catch (error) {
    const syncError: SyncError = {
      code: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown sync error',
      recoverable: true,
    }
    result.errors.push(syncError)
    result.success = false

    await updateSyncState({
      status: 'error',
      lastError: syncError.message,
      lastErrorAt: Date.now(),
    })

    return result
  }
}

// ============================================================================
// Pull Phase
// ============================================================================

/**
 * Pull changes from remote
 */
async function pullChanges(provider: SyncProvider, cursor: string | null): Promise<PullResult> {
  const allRecords: SyncRecord[] = []
  let currentCursor = cursor
  let hasMore = true

  // Paginate through all changes
  while (hasMore) {
    const result = await provider.pull(currentCursor)

    if (!result.success) {
      return result
    }

    allRecords.push(...result.records)
    currentCursor = result.cursor
    hasMore = result.hasMore
  }

  return {
    success: true,
    records: allRecords,
    cursor: currentCursor,
    hasMore: false,
  }
}

// ============================================================================
// Merge Phase
// ============================================================================

interface MergeRemoteResult {
  applied: {
    conversations: number
    messages: number
  }
  conflicts: ConflictRecord[]
}

/**
 * Merge remote changes into local database
 */
async function mergeRemoteChanges(
  records: SyncRecord[],
  autoResolve: boolean,
): Promise<MergeRemoteResult> {
  const result: MergeRemoteResult = {
    applied: { conversations: 0, messages: 0 },
    conflicts: [],
  }

  // Group records by entity type
  const conversations = records.filter((r) => r.entityType === 'conversation')
  const messages = records.filter((r) => r.entityType === 'message')

  // Process in a transaction
  await db.transaction('rw', [db.conversations, db.messages, db.conflicts], async () => {
    // Merge conversations
    for (const record of conversations) {
      const merged = await mergeRemoteConversation(record, autoResolve)
      if (merged.applied) {
        result.applied.conversations++
      }
      if (merged.conflict) {
        result.conflicts.push(merged.conflict)
      }
    }

    // Merge messages
    for (const record of messages) {
      const merged = await mergeRemoteMessage(record, autoResolve)
      if (merged.applied) {
        result.applied.messages++
      }
      if (merged.conflict) {
        result.conflicts.push(merged.conflict)
      }
    }
  })

  return result
}

interface MergeRecordResult {
  applied: boolean
  conflict: ConflictRecord | null
}

interface EntityTable<T> {
  get: (id: string) => Promise<T | undefined>
  add: (item: T) => Promise<unknown>
  put: (item: T) => Promise<unknown>
  update: (id: string, changes: Partial<T>) => Promise<unknown>
}

interface MergeEntityResult<T> {
  merged: T
  needsUserResolution: boolean
}

/**
 * Generic merge function for remote entities (conversations or messages)
 */
async function mergeRemoteEntity<T extends { dirty?: boolean }>(
  record: SyncRecord,
  entityType: EntityType,
  table: EntityTable<T>,
  mergeFn: (local: T, remote: T) => MergeEntityResult<T>,
  autoResolve: boolean,
): Promise<MergeRecordResult> {
  const remote = record.data as unknown as T
  const local = await table.get(record.id)

  // Handle deletion
  if (record.deleted) {
    if (local && !local.dirty) {
      await table.update(record.id, {
        deleted: true,
        deletedAt: Date.now(),
        dirty: false,
      } as unknown as Partial<T>)
      return { applied: true, conflict: null }
    }
    else if (local?.dirty) {
      if (!autoResolve) {
        const conflict = await createConflict(
          entityType,
          record.id,
          local as Record<string, unknown>,
          { ...(remote as Record<string, unknown>), deleted: true },
        )
        return { applied: false, conflict }
      }
      return { applied: false, conflict: null }
    }
    return { applied: true, conflict: null }
  }

  // New record
  if (!local) {
    await table.add({
      ...(remote as object),
      dirty: false,
      syncedAt: Date.now(),
    } as unknown as T)
    return { applied: true, conflict: null }
  }

  // Local not dirty - safe to overwrite
  if (!local.dirty) {
    await table.put({
      ...(remote as object),
      dirty: false,
      syncedAt: Date.now(),
    } as unknown as T)
    return { applied: true, conflict: null }
  }

  // Both have changes - need to merge
  const mergeResult = mergeFn(local, remote)

  if (mergeResult.needsUserResolution && !autoResolve) {
    const conflict = await createConflict(
      entityType,
      record.id,
      local as Record<string, unknown>,
      remote as Record<string, unknown>,
    )
    return { applied: false, conflict }
  }

  await table.put({
    ...(mergeResult.merged as object),
    dirty: false,
    syncedAt: Date.now(),
  } as unknown as T)

  return { applied: true, conflict: null }
}

/** Merge a single remote conversation */
async function mergeRemoteConversation(
  record: SyncRecord,
  autoResolve: boolean,
): Promise<MergeRecordResult> {
  return mergeRemoteEntity(
    record,
    'conversation',
    db.conversations as EntityTable<Conversation>,
    (local, remote) => {
      const result = mergeConversation(local, remote)
      return { merged: result.conversation, needsUserResolution: result.needsUserResolution }
    },
    autoResolve,
  )
}

/** Merge a single remote message */
async function mergeRemoteMessage(
  record: SyncRecord,
  autoResolve: boolean,
): Promise<MergeRecordResult> {
  return mergeRemoteEntity(
    record,
    'message',
    db.messages as EntityTable<Message>,
    (local, remote) => {
      const result = mergeMessage(local, remote)
      return { merged: result.message, needsUserResolution: result.needsUserResolution }
    },
    autoResolve,
  )
}

/**
 * Create and save a conflict record
 */
async function createConflict(
  entityType: EntityType,
  entityId: string,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Promise<ConflictRecord> {
  const conflictFields = findConflictFields(local, remote)

  const conflict: ConflictRecord = {
    id: crypto.randomUUID(),
    entityType,
    entityId,
    localVersion: local,
    remoteVersion: remote,
    conflictFields,
    resolution: 'pending',
    resolvedAt: null,
    createdAt: Date.now(),
  }

  await addConflict(conflict)
  return conflict
}

/**
 * Find fields that differ between local and remote
 */
function findConflictFields(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): string[] {
  const skipFields = new Set(['id', 'syncedAt', 'dirty', 'syncVersion', 'modifiedAt'])
  const conflicts: string[] = []

  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)])
  for (const key of allKeys) {
    if (skipFields.has(key)) continue
    if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
      conflicts.push(key)
    }
  }

  return conflicts
}

// ============================================================================
// Push Phase
// ============================================================================

interface PushChangesResult {
  success: boolean
  counts: {
    conversations: number
    messages: number
  }
  failed: Array<{ id: string, reason: string, serverVersion?: SyncRecord }>
  error?: SyncError
}

/**
 * Push local changes to remote
 */
async function pushChanges(provider: SyncProvider, batchSize: number): Promise<PushChangesResult> {
  const result: PushChangesResult = {
    success: true,
    counts: { conversations: 0, messages: 0 },
    failed: [],
  }

  try {
    // Get dirty records
    const dirtyConversations = await getDirtyConversations()
    const dirtyMessages = await getDirtyMessages()

    // Convert to sync records
    const conversationRecords = dirtyConversations.map((c) => toSyncRecord('conversation', c))
    const messageRecords = dirtyMessages.map((m) => toSyncRecord('message', m))

    const allRecords = [...conversationRecords, ...messageRecords]

    if (allRecords.length === 0) {
      return result
    }

    // Create Sets for O(1) lookup
    const conversationIdSet = new Set(conversationRecords.map((r) => r.id))
    const messageIdSet = new Set(messageRecords.map((r) => r.id))

    // Push in batches
    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize)
      const pushResult = await provider.push(batch)

      if (!pushResult.success && pushResult.error) {
        result.error = pushResult.error
        result.success = false
        return result
      }

      // Track successful pushes (O(n) with Set lookup)
      const appliedSet = new Set(pushResult.applied)
      const appliedConvIds = pushResult.applied.filter((id) => conversationIdSet.has(id))
      const appliedMsgIds = pushResult.applied.filter((id) => messageIdSet.has(id))

      result.counts.conversations += appliedConvIds.length
      result.counts.messages += appliedMsgIds.length

      // Clear dirty flags for successful records
      await clearDirtyFlags(appliedConvIds, appliedMsgIds)

      // Mark operations as synced (O(n) with Set lookup)
      const pendingOps = await getPendingOperations()
      const syncedOpIds = pendingOps.filter((op) => appliedSet.has(op.entityId)).map((op) => op.id)
      if (syncedOpIds.length > 0) {
        await markOperationsSynced(syncedOpIds)
      }

      // Track failures
      result.failed.push(
        ...pushResult.failed.map((f) => ({
          id: f.id,
          reason: f.reason,
          serverVersion: f.serverVersion,
        })),
      )
    }

    return result
  }
  catch (error) {
    result.error = {
      code: 'network_error',
      message: error instanceof Error ? error.message : 'Push failed',
      recoverable: true,
    }
    result.success = false
    return result
  }
}

/**
 * Handle a push conflict by re-merging with server version
 */
async function handlePushConflict(
  serverVersion: SyncRecord,
  autoResolve: boolean,
): Promise<ConflictRecord | null> {
  if (serverVersion.entityType === 'conversation') {
    const result = await mergeRemoteConversation(serverVersion, autoResolve)
    return result.conflict
  }
  else {
    const result = await mergeRemoteMessage(serverVersion, autoResolve)
    return result.conflict
  }
}

/**
 * Convert a local record to a sync record
 */
function toSyncRecord(entityType: EntityType, record: Record<string, unknown>): SyncRecord {
  return {
    id: record.id as string,
    entityType,
    data: record,
    syncVersion: (record.syncVersion as number) ?? 1,
    modifiedAt: (record.modifiedAt as number) ?? Date.now(),
    deleted: (record.deleted as boolean) ?? false,
  }
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Apply a conflict resolution
 */
export async function applyConflictResolution(
  conflictId: string,
  resolution: 'local' | 'remote' | 'merged',
  mergedData?: Record<string, unknown>,
): Promise<void> {
  const conflict = await db.conflicts.get(conflictId)
  if (!conflict) {
    throw new Error(`Conflict not found: ${conflictId}`)
  }

  const dataToApply
    = resolution === 'local'
      ? conflict.localVersion
      : resolution === 'remote'
        ? conflict.remoteVersion
        : mergedData

  if (!dataToApply) {
    throw new Error('No data to apply for resolution')
  }

  await db.transaction('rw', [db.conversations, db.messages, db.conflicts], async () => {
    if (conflict.entityType === 'conversation') {
      await db.conversations.put({
        ...(dataToApply as Conversation),
        dirty: resolution === 'local', // If keeping local, still need to push
        syncedAt: Date.now(),
      })
    }
    else {
      await db.messages.put({
        ...(dataToApply as Message),
        dirty: resolution === 'local',
        syncedAt: Date.now(),
      })
    }

    // Mark conflict as resolved
    await db.conflicts.update(conflictId, {
      resolution,
      resolvedAt: Date.now(),
    })
  })
}

// ============================================================================
// Incremental Sync
// ============================================================================

/**
 * Perform a quick pull-only sync (for background refresh)
 */
export async function pullOnly(provider: SyncProvider): Promise<{
  success: boolean
  pulled: number
  error?: SyncError
}> {
  try {
    const syncState = await getSyncState()
    const cursor = syncState?.remoteCursor ?? null

    const pullResult = await pullChanges(provider, cursor)

    if (!pullResult.success) {
      return {
        success: false,
        pulled: 0,
        error: pullResult.error,
      }
    }

    const mergeResult = await mergeRemoteChanges(pullResult.records, true)

    if (pullResult.cursor) {
      await updateSyncState({
        remoteCursor: pullResult.cursor,
        lastPullAt: Date.now(),
      })
    }

    return {
      success: true,
      pulled: mergeResult.applied.conversations + mergeResult.applied.messages,
    }
  }
  catch (error) {
    return {
      success: false,
      pulled: 0,
      error: {
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Pull failed',
        recoverable: true,
      },
    }
  }
}

/**
 * Perform a quick push-only sync (for immediate upload)
 */
export async function pushOnly(provider: SyncProvider): Promise<{
  success: boolean
  pushed: number
  error?: SyncError
}> {
  const result = await pushChanges(provider, 50)
  return {
    success: result.success,
    pushed: result.counts.conversations + result.counts.messages,
    error: result.error,
  }
}
