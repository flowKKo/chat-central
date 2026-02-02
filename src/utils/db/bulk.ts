import type { Platform } from '@/types'
import { db } from './schema'
import { invalidateSearchIndex } from './search-index'

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    await db.conversations.clear()
    await db.messages.clear()
  })
  invalidateSearchIndex()
}

/**
 * Clear all data for a specific platform
 */
export async function clearPlatformData(platform: Platform): Promise<void> {
  await db.transaction('rw', [db.conversations, db.messages], async () => {
    const conversationIds = await db.conversations.where('platform').equals(platform).primaryKeys()

    for (const id of conversationIds) {
      await db.messages.where('conversationId').equals(id).delete()
    }

    await db.conversations.where('platform').equals(platform).delete()
  })
  invalidateSearchIndex()
}
