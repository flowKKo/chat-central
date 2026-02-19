import type { SyncError, SyncProvider } from '../types'
import { updateSyncState, getSyncState } from '@/utils/db'
import type { SyncCycleResult, SyncEngineOptions } from './types'
import { pullChanges } from './pull'
import { mergeRemoteChanges } from './merge'
import { pushChanges } from './push'
import { handlePushConflict } from './resolve'

// ============================================================================
// Sync Cycle
// ============================================================================

/**
 * Execute a full sync cycle: Pull -> Merge -> Push
 */
export async function syncCycle(
  provider: SyncProvider,
  options: SyncEngineOptions = {}
): Promise<SyncCycleResult> {
  const { pushBatchSize = 50, autoResolveConflicts = true } = options

  const result: SyncCycleResult = {
    success: true,
    pulled: { conversations: 0, messages: 0 },
    pushed: { conversations: 0, messages: 0 },
    conflicts: [],
    errors: [],
  }

  try {
    // Update sync state to syncing
    await updateSyncState({ status: 'syncing', lastError: null })

    // Get current sync state
    const syncState = await getSyncState()
    const cursor = syncState?.remoteCursor ?? null

    // ========== PULL ==========
    const pullResult = await pullChanges(provider, cursor)

    if (!pullResult.success && pullResult.error) {
      result.errors.push(pullResult.error)
      result.success = false
      await updateSyncState({
        status: 'error',
        lastError: pullResult.error.message,
        lastErrorAt: Date.now(),
      })
      return result
    }

    // ========== MERGE ==========
    const mergeResult = await mergeRemoteChanges(pullResult.records, autoResolveConflicts)

    result.pulled = mergeResult.applied
    result.conflicts.push(...mergeResult.conflicts)

    // ========== PUSH ==========
    const pushResult = await pushChanges(provider, pushBatchSize)

    if (!pushResult.success && pushResult.error) {
      result.errors.push(pushResult.error)
      // Don't fail the whole sync if push fails - pull was successful
    }

    result.pushed = pushResult.counts

    // Handle push failures
    if (pushResult.failed.length > 0) {
      for (const failed of pushResult.failed) {
        if (failed.reason === 'conflict' && failed.serverVersion) {
          // Re-merge with server version
          const conflict = await handlePushConflict(failed.serverVersion, autoResolveConflicts)
          if (conflict) {
            result.conflicts.push(conflict)
          }
        }
      }
    }

    // Update sync state and cursor AFTER push completes.
    // Moving the cursor update here prevents data loss when push fails:
    // if cursor were updated before push and push failed, the next sync
    // would skip the already-pulled records while local changes remain unpushed.
    const finalStatus = result.conflicts.length > 0 ? 'conflict' : 'idle'
    await updateSyncState({
      status: finalStatus,
      lastPushAt: Date.now(),
      pendingConflicts: result.conflicts.filter((c) => c.resolution === 'pending').length,
      ...(pullResult.cursor && {
        remoteCursor: pullResult.cursor,
        lastPullAt: Date.now(),
      }),
    })

    return result
  } catch (error) {
    const syncError: SyncError = {
      code: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown sync error',
      recoverable: true,
    }
    result.errors.push(syncError)
    result.success = false

    await updateSyncState({
      status: 'error',
      lastError: syncError.message,
      lastErrorAt: Date.now(),
    })

    return result
  }
}

// ============================================================================
// Incremental Sync
// ============================================================================

/**
 * Perform a quick pull-only sync (for background refresh)
 */
export async function pullOnly(provider: SyncProvider): Promise<{
  success: boolean
  pulled: number
  error?: SyncError
}> {
  try {
    const syncState = await getSyncState()
    const cursor = syncState?.remoteCursor ?? null

    const pullResult = await pullChanges(provider, cursor)

    if (!pullResult.success) {
      return {
        success: false,
        pulled: 0,
        error: pullResult.error,
      }
    }

    const mergeResult = await mergeRemoteChanges(pullResult.records, true)

    if (pullResult.cursor) {
      await updateSyncState({
        remoteCursor: pullResult.cursor,
        lastPullAt: Date.now(),
      })
    }

    return {
      success: true,
      pulled: mergeResult.applied.conversations + mergeResult.applied.messages,
    }
  } catch (error) {
    return {
      success: false,
      pulled: 0,
      error: {
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Pull failed',
        recoverable: true,
      },
    }
  }
}

/**
 * Perform a quick push-only sync (for immediate upload)
 */
export async function pushOnly(provider: SyncProvider): Promise<{
  success: boolean
  pushed: number
  error?: SyncError
}> {
  const result = await pushChanges(provider, 50)
  return {
    success: result.success,
    pushed: result.counts.conversations + result.counts.messages,
    error: result.error,
  }
}
