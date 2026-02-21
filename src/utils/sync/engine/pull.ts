import { createLogger } from '@/utils/logger'
import type { PullResult, SyncProvider, SyncRecord } from '../types'

const log = createLogger('SyncPull')

const MAX_PULL_PAGES = 1000

/**
 * Pull changes from remote
 */
export async function pullChanges(
  provider: SyncProvider,
  cursor: string | null
): Promise<PullResult> {
  const allRecords: SyncRecord[] = []
  let currentCursor = cursor
  let hasMore = true
  let page = 0

  // Paginate through all changes
  while (hasMore) {
    if (++page > MAX_PULL_PAGES) {
      log.error(`Pull exceeded ${MAX_PULL_PAGES} pages, aborting to prevent infinite loop`)
      break
    }

    const result = await provider.pull(currentCursor)

    if (!result.success) {
      return result
    }

    allRecords.push(...result.records)
    currentCursor = result.cursor
    hasMore = result.hasMore
  }

  return {
    success: true,
    records: allRecords,
    cursor: currentCursor,
    hasMore: false,
  }
}
