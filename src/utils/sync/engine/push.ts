import type { EntityType, SyncProvider, SyncRecord } from '../types'
import {
  getDirtyConversations,
  getDirtyMessages,
  clearDirtyFlags,
  getPendingOperations,
  markOperationsSynced,
} from '@/utils/db'
import type { PushChangesResult } from './types'

// ============================================================================
// Push Phase
// ============================================================================

/**
 * Push local changes to remote
 */
export async function pushChanges(
  provider: SyncProvider,
  batchSize: number
): Promise<PushChangesResult> {
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

    // Fetch pending operations once before the loop to avoid N+1 queries
    const pendingOps = await getPendingOperations()

    // Accumulate successful IDs across all batches — only clear dirty flags
    // after ALL batches complete to prevent data loss on partial failure.
    const allAppliedConvIds: string[] = []
    const allAppliedMsgIds: string[] = []
    const allAppliedEntityIds = new Set<string>()

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
      const appliedConvIds = pushResult.applied.filter((id) => conversationIdSet.has(id))
      const appliedMsgIds = pushResult.applied.filter((id) => messageIdSet.has(id))

      result.counts.conversations += appliedConvIds.length
      result.counts.messages += appliedMsgIds.length

      allAppliedConvIds.push(...appliedConvIds)
      allAppliedMsgIds.push(...appliedMsgIds)
      for (const id of pushResult.applied) allAppliedEntityIds.add(id)

      // Track failures
      result.failed.push(
        ...pushResult.failed.map((f) => ({
          id: f.id,
          reason: f.reason,
          serverVersion: f.serverVersion,
        }))
      )
    }

    // Clear dirty flags only after all batches succeed
    await clearDirtyFlags(allAppliedConvIds, allAppliedMsgIds)

    // Mark operations as synced
    const syncedOpIds = pendingOps
      .filter((op) => allAppliedEntityIds.has(op.entityId))
      .map((op) => op.id)
    if (syncedOpIds.length > 0) {
      await markOperationsSynced(syncedOpIds)
    }

    return result
  } catch (error) {
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
 * Convert a local record to a sync record
 */
export function toSyncRecord(entityType: EntityType, record: Record<string, unknown>): SyncRecord {
  return {
    id: record.id as string,
    entityType,
    data: record,
    syncVersion: (record.syncVersion as number) ?? 1,
    modifiedAt: (record.modifiedAt as number) ?? Date.now(),
    deleted: (record.deleted as boolean) ?? false,
  }
}
