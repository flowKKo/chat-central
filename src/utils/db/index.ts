import Dexie, { type EntityTable } from 'dexie'
import type { Conversation, Message, Platform } from '@/types'

// ============================================================================
// Database Schema
// ============================================================================

export class ChatCentralDB extends Dexie {
  conversations!: EntityTable<Conversation, 'id'>
  messages!: EntityTable<Message, 'id'>

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

  return query.offset(offset).limit(limit).toArray()
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
