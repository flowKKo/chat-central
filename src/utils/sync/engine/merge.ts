import type { ConflictRecord, EntityType, SyncRecord } from '../types'
import { mergeConversation, mergeMessage } from '../merge'
import type { Conversation, Message } from '@/types'
import { db, addConflict } from '@/utils/db'
import type { EntityTable, MergeEntityResult, MergeRecordResult, MergeRemoteResult } from './types'

// ============================================================================
// Merge Phase
// ============================================================================

/**
 * Merge remote changes into local database
 */
export async function mergeRemoteChanges(
  records: SyncRecord[],
  autoResolve: boolean
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

/**
 * Generic merge function for remote entities (conversations or messages)
 */
async function mergeRemoteEntity<T extends { dirty?: boolean }>(
  record: SyncRecord,
  entityType: EntityType,
  table: EntityTable<T>,
  mergeFn: (local: T, remote: T) => MergeEntityResult<T>,
  autoResolve: boolean
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
    } else if (local?.dirty) {
      if (!autoResolve) {
        const conflict = await createConflict(
          entityType,
          record.id,
          local as Record<string, unknown>,
          { ...(remote as Record<string, unknown>), deleted: true }
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
      remote as Record<string, unknown>
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
export async function mergeRemoteConversation(
  record: SyncRecord,
  autoResolve: boolean
): Promise<MergeRecordResult> {
  return mergeRemoteEntity(
    record,
    'conversation',
    db.conversations as EntityTable<Conversation>,
    (local, remote) => {
      const result = mergeConversation(local, remote)
      return { merged: result.conversation, needsUserResolution: result.needsUserResolution }
    },
    autoResolve
  )
}

/** Merge a single remote message */
export async function mergeRemoteMessage(
  record: SyncRecord,
  autoResolve: boolean
): Promise<MergeRecordResult> {
  return mergeRemoteEntity(
    record,
    'message',
    db.messages as EntityTable<Message>,
    (local, remote) => {
      const result = mergeMessage(local, remote)
      return { merged: result.message, needsUserResolution: result.needsUserResolution }
    },
    autoResolve
  )
}

/**
 * Create and save a conflict record
 */
export async function createConflict(
  entityType: EntityType,
  entityId: string,
  local: Record<string, unknown>,
  remote: Record<string, unknown>
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
export function findConflictFields(
  local: Record<string, unknown>,
  remote: Record<string, unknown>
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
