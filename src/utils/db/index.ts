import Dexie, { type EntityTable } from 'dexie'
import type { Conversation, Message, Platform } from '@/types'
import type { OperationLog, SyncState, ConflictRecord } from '@/utils/sync/types'

// ============================================================================
// Database Schema
// ============================================================================

export class ChatCentralDB extends Dexie {
  conversations!: EntityTable<Conversation, 'id'>
  messages!: EntityTable<Message, 'id'>
  operationLog!: EntityTable<OperationLog, 'id'>
  syncState!: EntityTable<SyncState, 'id'>
  conflicts!: EntityTable<ConflictRecord, 'id'>

  constructor() {
    super('ChatCentralDB')

    this.version(1).stores({
      conversations: 'id, platform, updatedAt, syncedAt, *tags',
      messages: 'id, conversationId, createdAt',
    })

    this.version(2)
      .stores({
        conversations: 'id, platform, updatedAt, syncedAt, *tags',
        messages: 'id, conversationId, createdAt',
      })
      .upgrade(async (tx) => {
        await tx.table('conversations').toCollection().modify((conv) => {
          if (!('detailStatus' in conv)) conv.detailStatus = 'none'
          if (!('detailSyncedAt' in conv)) conv.detailSyncedAt = null
        })
      })

    this.version(3)
      .stores({
        conversations: 'id, platform, updatedAt, syncedAt, isFavorite, favoriteAt, *tags',
        messages: 'id, conversationId, createdAt',
      })
      .upgrade(async (tx) => {
        await tx.table('conversations').toCollection().modify((conv) => {
          if (!('detailStatus' in conv)) conv.detailStatus = 'none'
          if (!('detailSyncedAt' in conv)) conv.detailSyncedAt = null
          if (!('isFavorite' in conv)) conv.isFavorite = false
          if (!('favoriteAt' in conv)) conv.favoriteAt = null
        })
      })

    // Version 4: Add sync-related fields and tables
    this.version(4)
      .stores({
        conversations: 'id, platform, updatedAt, syncedAt, isFavorite, favoriteAt, dirty, deleted, modifiedAt, *tags',
        messages: 'id, conversationId, createdAt, dirty, deleted, modifiedAt',
        operationLog: 'id, entityType, entityId, timestamp, synced',
        syncState: 'id',
        conflicts: 'id, entityType, entityId, resolution, createdAt',
      })
      .upgrade(async (tx) => {
        // Add sync fields to conversations
        await tx.table('conversations').toCollection().modify((conv) => {
          if (!('syncVersion' in conv)) conv.syncVersion = 1
          if (!('modifiedAt' in conv)) conv.modifiedAt = conv.updatedAt || Date.now()
          if (!('dirty' in conv)) conv.dirty = false
          if (!('deleted' in conv)) conv.deleted = false
          if (!('deletedAt' in conv)) conv.deletedAt = null
        })

        // Add sync fields to messages
        await tx.table('messages').toCollection().modify((msg) => {
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

export const db = new ChatCentralDB()

// ============================================================================
// Conversation Operations
// ============================================================================

export async function getConversations(options?: {
  platform?: Platform
  limit?: number
  offset?: number
  favoritesOnly?: boolean
  orderBy?: 'updatedAt' | 'createdAt' | 'syncedAt' | 'favoriteAt'
}): Promise<Conversation[]> {
  const {
    platform,
    limit = 50,
    offset = 0,
    favoritesOnly = false,
    orderBy = 'updatedAt',
  } = options ?? {}

  let query = db.conversations.orderBy(orderBy).reverse()

  if (platform) {
    query = db.conversations.where('platform').equals(platform).reverse()
  }

  if (favoritesOnly) {
    query = query.filter((conv) => conv.isFavorite)
  }

  const results = await query.offset(offset).limit(limit).toArray()
  if (results.length > 0) return results

  const totalCount = platform
    ? await db.conversations.where('platform').equals(platform).count()
    : await db.conversations.count()

  if (totalCount === 0) return results

  const all = await db.conversations.toArray()
  let filtered = all
  if (platform) filtered = filtered.filter((conv) => conv.platform === platform)
  if (favoritesOnly) filtered = filtered.filter((conv) => conv.isFavorite)

  const score = (conv: Conversation) => {
    switch (orderBy) {
      case 'createdAt':
        return conv.createdAt ?? 0
      case 'syncedAt':
        return conv.syncedAt ?? 0
      case 'favoriteAt':
        return conv.favoriteAt ?? 0
      default:
        return conv.updatedAt ?? 0
    }
  }

  filtered.sort((a, b) => score(b) - score(a))
  return filtered.slice(offset, offset + limit)
}

export async function getConversationById(id: string): Promise<Conversation | undefined> {
  return db.conversations.get(id)
}

export async function getExistingMessageIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const results = await db.messages.bulkGet(ids)
  const existing = new Set<string>()
  for (const msg of results) {
    if (msg?.id) existing.add(msg.id)
  }
  return existing
}

export async function getMessagesByIds(ids: string[]): Promise<Map<string, Message>> {
  if (ids.length === 0) return new Map()
  const results = await db.messages.bulkGet(ids)
  const existing = new Map<string, Message>()
  for (const msg of results) {
    if (msg?.id) existing.set(msg.id, msg)
  }
  return existing
}

export async function getConversationByOriginalId(
  platform: Platform,
  originalId: string
): Promise<Conversation | undefined> {
  const id = `${platform}_${originalId}`
  return db.conversations.get(id)
}

export async function upsertConversation(conversation: Conversation): Promise<void> {
  await db.conversations.put(conversation)
}

export async function updateConversationFavorite(
  id: string,
  isFavorite: boolean
): Promise<Conversation | null> {
  const existing = await db.conversations.get(id)
  if (!existing) return null

  const favoriteAt = isFavorite ? existing.favoriteAt ?? Date.now() : null
  const updated = { ...existing, isFavorite, favoriteAt }
  await db.conversations.put(updated)
  return updated
}

export async function upsertConversations(conversations: Conversation[]): Promise<void> {
  await db.conversations.bulkPut(conversations)
}

export async function deleteConversation(id: string): Promise<void> {
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    await db.messages.where('conversationId').equals(id).delete()
    await db.conversations.delete(id)
  })
}

export async function getConversationCount(platform?: Platform): Promise<number> {
  if (platform) {
    return db.conversations.where('platform').equals(platform).count()
  }
  return db.conversations.count()
}

export async function getFavoriteConversationCount(platform?: Platform): Promise<number> {
  if (platform) {
    return db.conversations.where('platform').equals(platform).filter((conv) => conv.isFavorite).count()
  }
  return db.conversations.filter((conv) => conv.isFavorite).count()
}

// ============================================================================
// Message Operations
// ============================================================================

export async function getMessagesByConversationId(conversationId: string): Promise<Message[]> {
  return db.messages.where('conversationId').equals(conversationId).sortBy('createdAt')
}

export async function upsertMessages(messages: Message[]): Promise<void> {
  await db.messages.bulkPut(messages)
}

export async function deleteMessagesByConversationId(conversationId: string): Promise<void> {
  await db.messages.where('conversationId').equals(conversationId).delete()
}

// ============================================================================
// Bulk Operations
// ============================================================================

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    await db.conversations.clear()
    await db.messages.clear()
  })
}

export async function clearPlatformData(platform: Platform): Promise<void> {
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    const conversationIds = await db.conversations
      .where('platform')
      .equals(platform)
      .primaryKeys()

    for (const id of conversationIds) {
      await db.messages.where('conversationId').equals(id).delete()
    }

    await db.conversations.where('platform').equals(platform).delete()
  })
}

// ============================================================================
// Search Operations
// ============================================================================

export async function searchConversations(query: string): Promise<Conversation[]> {
  const lowerQuery = query.toLowerCase()

  // Simple title search, can be enhanced with MiniSearch later
  return db.conversations
    .filter((conv) => conv.title.toLowerCase().includes(lowerQuery))
    .limit(50)
    .toArray()
}

export async function searchConversationsAndMessages(query: string): Promise<Conversation[]> {
  const lowerQuery = query.toLowerCase()

  // 1. Find conversations with matching titles
  const titleMatches = await db.conversations
    .filter((conv) => conv.title.toLowerCase().includes(lowerQuery))
    .primaryKeys()

  // 2. Find messages with matching content
  // We limit to 500 matches to prevent performance issues
  const messageMatches = await db.messages
    .filter((msg) => msg.content.toLowerCase().includes(lowerQuery))
    .limit(500)
    .toArray()
  
  const messageConvIds = messageMatches.map((m) => m.conversationId)

  // 3. Combine unique Conversation IDs
  const allIds = new Set([...titleMatches, ...messageConvIds])

  // 4. Fetch full conversation objects
  // We assume the number of unique matches isn't massive (e.g. < 1000)
  // If it grows, we might need to paginate this search too.
  const results = await db.conversations.bulkGet(Array.from(allIds))
  
  // Filter out undefined and sort by updatedAt desc
  return results
    .filter((c): c is Conversation => !!c)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export async function searchMessages(query: string): Promise<Message[]> {
  const lowerQuery = query.toLowerCase()

  return db.messages
    .filter((msg) => msg.content.toLowerCase().includes(lowerQuery))
    .limit(100)
    .toArray()
}

// ============================================================================
// Stats
// ============================================================================

export interface DBStats {
  totalConversations: number
  totalMessages: number
  byPlatform: Record<Platform, number>
  oldestConversation: number | null
  newestConversation: number | null
}

export async function getDBStats(): Promise<DBStats> {
  const [totalConversations, totalMessages, claudeCount, chatgptCount, geminiCount, oldest, newest] =
    await Promise.all([
      db.conversations.count(),
      db.messages.count(),
      db.conversations.where('platform').equals('claude').count(),
      db.conversations.where('platform').equals('chatgpt').count(),
      db.conversations.where('platform').equals('gemini').count(),
      db.conversations.orderBy('createdAt').first(),
      db.conversations.orderBy('createdAt').last(),
    ])

  return {
    totalConversations,
    totalMessages,
    byPlatform: {
      claude: claudeCount,
      chatgpt: chatgptCount,
      gemini: geminiCount,
    },
    oldestConversation: oldest?.createdAt ?? null,
    newestConversation: newest?.createdAt ?? null,
  }
}

// ============================================================================
// Sync State Operations
// ============================================================================

export async function getSyncState(): Promise<SyncState | undefined> {
  return db.syncState.get('global')
}

export async function updateSyncState(updates: Partial<Omit<SyncState, 'id'>>): Promise<void> {
  await db.syncState.update('global', updates)
}

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

export async function getPendingOperations(): Promise<OperationLog[]> {
  return db.operationLog.where('synced').equals(0).sortBy('timestamp')
}

export async function markOperationsSynced(ids: string[]): Promise<void> {
  const now = Date.now()
  await db.operationLog.where('id').anyOf(ids).modify({
    synced: true,
    syncedAt: now,
  })
}

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

export async function addConflict(conflict: Omit<ConflictRecord, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID()
  await db.conflicts.add({
    ...conflict,
    id,
    createdAt: Date.now(),
  })
  return id
}

export async function getPendingConflicts(): Promise<ConflictRecord[]> {
  return db.conflicts.where('resolution').equals('pending').toArray()
}

export async function resolveConflict(
  id: string,
  resolution: ConflictRecord['resolution']
): Promise<void> {
  await db.conflicts.update(id, {
    resolution,
    resolvedAt: Date.now(),
  })
}

export async function getConflictById(id: string): Promise<ConflictRecord | undefined> {
  return db.conflicts.get(id)
}

export async function cleanupResolvedConflicts(olderThanMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - olderThanMs
  return db.conflicts
    .filter((c) => c.resolution !== 'pending' && (c.resolvedAt ?? 0) < cutoff)
    .delete()
}

// ============================================================================
// Dirty Tracking Operations
// ============================================================================

export async function getDirtyConversations(): Promise<Conversation[]> {
  return db.conversations.where('dirty').equals(1).toArray()
}

export async function getDirtyMessages(): Promise<Message[]> {
  return db.messages.where('dirty').equals(1).toArray()
}

export async function markConversationDirty(id: string): Promise<void> {
  const now = Date.now()
  await db.conversations.update(id, {
    dirty: true,
    modifiedAt: now,
    syncVersion: (await db.conversations.get(id))?.syncVersion ?? 0 + 1,
  } as Partial<Conversation>)
}

export async function markMessageDirty(id: string): Promise<void> {
  const now = Date.now()
  await db.messages.update(id, {
    dirty: true,
    modifiedAt: now,
    syncVersion: (await db.messages.get(id))?.syncVersion ?? 0 + 1,
  } as Partial<Message>)
}

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

// ============================================================================
// Soft Delete Operations
// ============================================================================

export async function softDeleteConversation(id: string): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', [db.conversations, db.messages, db.operationLog], async () => {
    // Mark conversation as deleted
    await db.conversations.update(id, {
      deleted: true,
      deletedAt: now,
      dirty: true,
      modifiedAt: now,
    } as Partial<Conversation>)

    // Mark all messages as deleted
    await db.messages.where('conversationId').equals(id).modify({
      deleted: true,
      deletedAt: now,
      dirty: true,
      modifiedAt: now,
    })

    // Log the operation
    await db.operationLog.add({
      id: crypto.randomUUID(),
      entityType: 'conversation',
      entityId: id,
      operation: 'delete',
      changes: { deleted: true, deletedAt: now },
      timestamp: now,
      synced: false,
      syncedAt: null,
    })
  })
}

export async function getDeletedConversations(): Promise<Conversation[]> {
  return db.conversations.where('deleted').equals(1).toArray()
}

export async function permanentlyDeleteConversation(id: string): Promise<void> {
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    await db.messages.where('conversationId').equals(id).delete()
    await db.conversations.delete(id)
  })
}

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

// ============================================================================
// Export Data (for sync export)
// ============================================================================

export async function getAllConversationsForExport(options?: {
  since?: number
  platforms?: Platform[]
  includeDeleted?: boolean
}): Promise<Conversation[]> {
  let query = db.conversations.toCollection()

  if (options?.platforms && options.platforms.length > 0) {
    query = db.conversations.where('platform').anyOf(options.platforms)
  }

  let results = await query.toArray()

  if (options?.since) {
    results = results.filter((c) => (c.modifiedAt ?? c.updatedAt) >= options.since!)
  }

  if (!options?.includeDeleted) {
    results = results.filter((c) => !c.deleted)
  }

  return results
}

export async function getAllMessagesForExport(
  conversationIds: string[],
  options?: { includeDeleted?: boolean }
): Promise<Message[]> {
  if (conversationIds.length === 0) return []

  let results = await db.messages.where('conversationId').anyOf(conversationIds).toArray()

  if (!options?.includeDeleted) {
    results = results.filter((m) => !m.deleted)
  }

  return results
}
