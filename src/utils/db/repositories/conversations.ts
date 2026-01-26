import { db } from '../schema'
import type { Conversation, Platform } from '@/types'

/**
 * Get conversations with optional filtering and pagination
 */
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

  // Sorting function for in-memory sorting
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

  // No platform filter: use indexed query (efficient)
  if (!platform) {
    let query = db.conversations.orderBy(orderBy).reverse()
    if (favoritesOnly) {
      query = query.filter((conv) => conv.isFavorite)
    }
    return query.offset(offset).limit(limit).toArray()
  }

  // With platform filter: Dexie can't combine .where().equals() with .orderBy()
  // so we filter first, then sort in memory
  let query = db.conversations.where('platform').equals(platform)
  if (favoritesOnly) {
    query = query.filter((conv) => conv.isFavorite)
  }

  const filtered = await query.toArray()
  filtered.sort((a, b) => score(b) - score(a))
  return filtered.slice(offset, offset + limit)
}

/**
 * Get a single conversation by ID
 */
export async function getConversationById(id: string): Promise<Conversation | undefined> {
  return db.conversations.get(id)
}

/**
 * Get a conversation by platform and original ID
 */
export async function getConversationByOriginalId(
  platform: Platform,
  originalId: string,
): Promise<Conversation | undefined> {
  const id = `${platform}_${originalId}`
  return db.conversations.get(id)
}

/**
 * Insert or update a single conversation
 */
export async function upsertConversation(conversation: Conversation): Promise<void> {
  await db.conversations.put(conversation)
}

/**
 * Insert or update multiple conversations
 */
export async function upsertConversations(conversations: Conversation[]): Promise<void> {
  await db.conversations.bulkPut(conversations)
}

/**
 * Update conversation favorite status
 */
export async function updateConversationFavorite(
  id: string,
  isFavorite: boolean,
): Promise<Conversation | null> {
  const existing = await db.conversations.get(id)
  if (!existing) return null

  const favoriteAt = isFavorite ? (existing.favoriteAt ?? Date.now()) : null
  const updated = { ...existing, isFavorite, favoriteAt }
  await db.conversations.put(updated)
  return updated
}

/**
 * Delete a conversation and its messages
 */
export async function deleteConversation(id: string): Promise<void> {
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    await db.messages.where('conversationId').equals(id).delete()
    await db.conversations.delete(id)
  })
}

/**
 * Get conversation count
 */
export async function getConversationCount(platform?: Platform): Promise<number> {
  if (platform) {
    return db.conversations.where('platform').equals(platform).count()
  }
  return db.conversations.count()
}

/**
 * Get favorite conversation count
 */
export async function getFavoriteConversationCount(platform?: Platform): Promise<number> {
  if (platform) {
    return db.conversations
      .where('platform')
      .equals(platform)
      .filter((conv) => conv.isFavorite)
      .count()
  }
  return db.conversations.filter((conv) => conv.isFavorite).count()
}

/**
 * Soft delete a conversation (mark as deleted without removing)
 */
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

/**
 * Get all soft-deleted conversations
 */
export async function getDeletedConversations(): Promise<Conversation[]> {
  return db.conversations.where('deleted').equals(1).toArray()
}

/**
 * Permanently delete a conversation
 */
export async function permanentlyDeleteConversation(id: string): Promise<void> {
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    await db.messages.where('conversationId').equals(id).delete()
    await db.conversations.delete(id)
  })
}

/**
 * Get all conversations for export
 */
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

/**
 * Get all unique tags from all conversations
 * Uses Dexie's multiEntry index for efficient retrieval
 */
export async function getAllTags(): Promise<string[]> {
  // Use the *tags multiEntry index to get unique tag values efficiently
  // This avoids loading all conversations into memory
  const uniqueTags = await db.conversations.orderBy('tags').uniqueKeys()

  // Filter out empty strings and ensure all values are strings
  const validTags = uniqueTags.filter(
    (tag): tag is string => typeof tag === 'string' && tag.length > 0,
  )

  return validTags.sort()
}

/**
 * Update tags for a conversation
 */
export async function updateConversationTags(
  id: string,
  tags: string[],
): Promise<Conversation | null> {
  const existing = await db.conversations.get(id)
  if (!existing) return null

  const now = Date.now()
  const updated = {
    ...existing,
    tags,
    modifiedAt: now,
    dirty: true,
  }
  await db.conversations.put(updated)
  return updated
}
