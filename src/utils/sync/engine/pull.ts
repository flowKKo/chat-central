import type { PullResult, SyncProvider, SyncRecord } from '../types'

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

  // Paginate through all changes
  while (hasMore) {
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
