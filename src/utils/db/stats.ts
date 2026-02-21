import type { Platform } from '@/types'
import { db } from './schema'

/**
 * Database statistics
 */
export interface DBStats {
  totalConversations: number
  totalMessages: number
  byPlatform: Record<Platform, number>
  oldestConversation: number | null
  newestConversation: number | null
}

/**
 * Get database statistics
 */
export async function getDBStats(): Promise<DBStats> {
  const [totalConversations, totalMessages, claudeCount, chatgptCount, geminiCount] =
    await Promise.all([
      db.conversations.count(),
      db.messages.count(),
      db.conversations.where('platform').equals('claude').count(),
      db.conversations.where('platform').equals('chatgpt').count(),
      db.conversations.where('platform').equals('gemini').count(),
    ])

  // Find min/max createdAt using cursor scan (createdAt is not indexed)
  let oldestTimestamp: number | null = null
  let newestTimestamp: number | null = null
  await db.conversations.each((conv) => {
    if (oldestTimestamp === null || conv.createdAt < oldestTimestamp) {
      oldestTimestamp = conv.createdAt
    }
    if (newestTimestamp === null || conv.createdAt > newestTimestamp) {
      newestTimestamp = conv.createdAt
    }
  })

  return {
    totalConversations,
    totalMessages,
    byPlatform: {
      claude: claudeCount,
      chatgpt: chatgptCount,
      gemini: geminiCount,
    },
    oldestConversation: oldestTimestamp,
    newestConversation: newestTimestamp,
  }
}
