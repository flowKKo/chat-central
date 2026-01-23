import Dexie, { type EntityTable } from 'dexie'
import type { Conversation, Message } from '@/types'
import type { OperationLog, SyncState, ConflictRecord } from '@/utils/sync/types'

/**
 * ChatCentralDB - Main database class using Dexie
 *
 * Tables:
 * - conversations: AI conversation metadata
 * - messages: Individual messages within conversations
 * - operationLog: Track local changes for sync
 * - syncState: Global sync state
 * - conflicts: Sync conflict records
 */
export class ChatCentralDB extends Dexie {
  conversations!: EntityTable<Conversation, 'id'>
  messages!: EntityTable<Message, 'id'>
  operationLog!: EntityTable<OperationLog, 'id'>
  syncState!: EntityTable<SyncState, 'id'>
  conflicts!: EntityTable<ConflictRecord, 'id'>

  constructor() {
    super('ChatCentralDB')

    // Version 1: Initial schema
    this.version(1).stores({
      conversations: 'id, platform, updatedAt, syncedAt, *tags',
      messages: 'id, conversationId, createdAt',
    })

    // Version 2: Add detail status fields
    this.version(2)
      .stores({
        conversations: 'id, platform, updatedAt, syncedAt, *tags',
        messages: 'id, conversationId, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('conversations')
          .toCollection()
          .modify((conv) => {
            if (!('detailStatus' in conv)) conv.detailStatus = 'none'
            if (!('detailSyncedAt' in conv)) conv.detailSyncedAt = null
          })
      })

    // Version 3: Add favorites support
    this.version(3)
      .stores({
        conversations: 'id, platform, updatedAt, syncedAt, isFavorite, favoriteAt, *tags',
        messages: 'id, conversationId, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('conversations')
          .toCollection()
          .modify((conv) => {
            if (!('detailStatus' in conv)) conv.detailStatus = 'none'
            if (!('detailSyncedAt' in conv)) conv.detailSyncedAt = null
            if (!('isFavorite' in conv)) conv.isFavorite = false
            if (!('favoriteAt' in conv)) conv.favoriteAt = null
          })
      })

    // Version 4: Add sync-related fields and tables
    this.version(4)
      .stores({
        conversations:
          'id, platform, updatedAt, syncedAt, isFavorite, favoriteAt, dirty, deleted, modifiedAt, *tags',
        messages: 'id, conversationId, createdAt, dirty, deleted, modifiedAt',
        operationLog: 'id, entityType, entityId, timestamp, synced',
        syncState: 'id',
        conflicts: 'id, entityType, entityId, resolution, createdAt',
      })
      .upgrade(async (tx) => {
        // Add sync fields to conversations
        await tx
          .table('conversations')
          .toCollection()
          .modify((conv) => {
            if (!('syncVersion' in conv)) conv.syncVersion = 1
            if (!('modifiedAt' in conv)) conv.modifiedAt = conv.updatedAt || Date.now()
            if (!('dirty' in conv)) conv.dirty = false
            if (!('deleted' in conv)) conv.deleted = false
            if (!('deletedAt' in conv)) conv.deletedAt = null
          })

        // Add sync fields to messages
        await tx
          .table('messages')
          .toCollection()
          .modify((msg) => {
            if (!('syncVersion' in msg)) msg.syncVersion = 1
            if (!('modifiedAt' in msg)) msg.modifiedAt = msg.createdAt || Date.now()
            if (!('syncedAt' in msg)) msg.syncedAt = null
            if (!('dirty' in msg)) msg.dirty = false
            if (!('deleted' in msg)) msg.deleted = false
            if (!('deletedAt' in msg)) msg.deletedAt = null
          })

        // Initialize sync state
        await tx.table('syncState').add({
          id: 'global',
          deviceId: crypto.randomUUID(),
          lastPullAt: null,
          lastPushAt: null,
          remoteCursor: null,
          pendingConflicts: 0,
          status: 'disabled',
          lastError: null,
          lastErrorAt: null,
        })
      })
  }
}

// Singleton database instance
export const db = new ChatCentralDB()
