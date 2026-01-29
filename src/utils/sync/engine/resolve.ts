import type { ConflictRecord, SyncRecord } from '../types'
import type { Conversation, Message } from '@/types'
import { db } from '@/utils/db'
import { mergeRemoteConversation, mergeRemoteMessage } from './merge'

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Apply a conflict resolution
 */
export async function applyConflictResolution(
  conflictId: string,
  resolution: 'local' | 'remote' | 'merged',
  mergedData?: Record<string, unknown>
): Promise<void> {
  const conflict = await db.conflicts.get(conflictId)
  if (!conflict) {
    throw new Error(`Conflict not found: ${conflictId}`)
  }

  const dataToApply =
    resolution === 'local'
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
    } else {
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

/**
 * Handle a push conflict by re-merging with server version
 */
export async function handlePushConflict(
  serverVersion: SyncRecord,
  autoResolve: boolean
): Promise<ConflictRecord | null> {
  if (serverVersion.entityType === 'conversation') {
    const result = await mergeRemoteConversation(serverVersion, autoResolve)
    return result.conflict
  } else {
    const result = await mergeRemoteMessage(serverVersion, autoResolve)
    return result.conflict
  }
}
