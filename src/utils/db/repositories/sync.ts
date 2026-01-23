import type { Conversation, Message } from '@/types'
import type { OperationLog, SyncState, ConflictRecord } from '@/utils/sync/types'
import { db } from '../schema'

// ============================================================================
// Sync State Operations
// ============================================================================

/**
 * Get the global sync state
 */
export async function getSyncState(): Promise<SyncState | undefined> {
  return db.syncState.get('global')
}

/**
 * Update sync state fields
 */
export async function updateSyncState(updates: Partial<Omit<SyncState, 'id'>>): Promise<void> {
  await db.syncState.update('global', updates)
}

/**
 * Initialize sync state if it doesn't exist
 */
export async function initializeSyncState(): Promise<SyncState> {
  const existing = await db.syncState.get('global')
  if (existing) return existing

  const state: SyncState = {
    id: 'global',
    deviceId: crypto.randomUUID(),
    lastPullAt: null,
    lastPushAt: null,
    remoteCursor: null,
    pendingConflicts: 0,
    status: 'disabled',
    lastError: null,
    lastErrorAt: null,
  }
  await db.syncState.add(state)
  return state
}

// ============================================================================
// Operation Log Operations
// ============================================================================

/**
 * Add an operation to the log
 */
export async function addOperationLog(log: Omit<OperationLog, 'id' | 'synced' | 'syncedAt'>): Promise<string> {
  const id = crypto.randomUUID()
  await db.operationLog.add({
    ...log,
    id,
    synced: false,
    syncedAt: null,
  })
  return id
}

/**
 * Get all pending (unsynced) operations
 */
export async function getPendingOperations(): Promise<OperationLog[]> {
  return db.operationLog.where('synced').equals(0).sortBy('timestamp')
}

/**
 * Mark operations as synced
 */
export async function markOperationsSynced(ids: string[]): Promise<void> {
  const now = Date.now()
  await db.operationLog.where('id').anyOf(ids).modify({
    synced: true,
    syncedAt: now,
  })
}

/**
 * Cleanup old synced operations
 */
export async function cleanupSyncedOperations(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - olderThanMs
  return db.operationLog
    .where('synced')
    .equals(1)
    .filter((log) => (log.syncedAt ?? 0) < cutoff)
    .delete()
}

// ============================================================================
// Conflict Operations
// ============================================================================

/**
 * Add a conflict record
 */
export async function addConflict(conflict: Omit<ConflictRecord, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID()
  await db.conflicts.add({
    ...conflict,
    id,
    createdAt: Date.now(),
  })
  return id
}

/**
 * Get all pending conflicts
 */
export async function getPendingConflicts(): Promise<ConflictRecord[]> {
  return db.conflicts.where('resolution').equals('pending').toArray()
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  id: string,
  resolution: ConflictRecord['resolution']
): Promise<void> {
  await db.conflicts.update(id, {
    resolution,
    resolvedAt: Date.now(),
  })
}

/**
 * Get a conflict by ID
 */
export async function getConflictById(id: string): Promise<ConflictRecord | undefined> {
  return db.conflicts.get(id)
}

/**
 * Cleanup old resolved conflicts
 */
export async function cleanupResolvedConflicts(olderThanMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - olderThanMs
  return db.conflicts
    .filter((c) => c.resolution !== 'pending' && (c.resolvedAt ?? 0) < cutoff)
    .delete()
}

// ============================================================================
// Dirty Tracking Operations
// ============================================================================

/**
 * Get all dirty (modified but not synced) conversations
 */
export async function getDirtyConversations(): Promise<Conversation[]> {
  return db.conversations.where('dirty').equals(1).toArray()
}

/**
 * Get all dirty messages
 */
export async function getDirtyMessages(): Promise<Message[]> {
  return db.messages.where('dirty').equals(1).toArray()
}

/**
 * Mark a conversation as dirty (needs sync)
 */
export async function markConversationDirty(id: string): Promise<void> {
  const now = Date.now()
  await db.conversations.update(id, {
    dirty: true,
    modifiedAt: now,
    syncVersion: (await db.conversations.get(id))?.syncVersion ?? 0 + 1,
  } as Partial<Conversation>)
}

/**
 * Mark a message as dirty
 */
export async function markMessageDirty(id: string): Promise<void> {
  const now = Date.now()
  await db.messages.update(id, {
    dirty: true,
    modifiedAt: now,
    syncVersion: (await db.messages.get(id))?.syncVersion ?? 0 + 1,
  } as Partial<Message>)
}

/**
 * Clear dirty flags after successful sync
 */
export async function clearDirtyFlags(conversationIds: string[], messageIds: string[]): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    if (conversationIds.length > 0) {
      await db.conversations.where('id').anyOf(conversationIds).modify({
        dirty: false,
        syncedAt: now,
      })
    }
    if (messageIds.length > 0) {
      await db.messages.where('id').anyOf(messageIds).modify({
        dirty: false,
        syncedAt: now,
      })
    }
  })
}

/**
 * Cleanup old deleted records
 */
export async function cleanupDeletedRecords(olderThanMs: number = 30 * 24 * 60 * 60 * 1000): Promise<{
  conversations: number
  messages: number
}> {
  const cutoff = Date.now() - olderThanMs
  let conversationsDeleted = 0
  let messagesDeleted = 0

  await db.transaction('rw', [db.conversations, db.messages], async () => {
    // Find old deleted conversations
    const deletedConvs = await db.conversations
      .where('deleted')
      .equals(1)
      .filter((c) => (c.deletedAt ?? 0) < cutoff)
      .primaryKeys()

    // Delete their messages first
    for (const convId of deletedConvs) {
      messagesDeleted += await db.messages.where('conversationId').equals(convId).delete()
    }

    // Delete conversations
    conversationsDeleted = await db.conversations
      .where('deleted')
      .equals(1)
      .filter((c) => (c.deletedAt ?? 0) < cutoff)
      .delete()

    // Delete orphaned deleted messages
    messagesDeleted += await db.messages
      .where('deleted')
      .equals(1)
      .filter((m) => (m.deletedAt ?? 0) < cutoff)
      .delete()
  })

  return { conversations: conversationsDeleted, messages: messagesDeleted }
}
