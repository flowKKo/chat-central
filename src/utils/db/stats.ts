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
