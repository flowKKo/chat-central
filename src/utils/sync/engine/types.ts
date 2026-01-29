import type { ConflictRecord, SyncError, SyncRecord } from '../types'

// ============================================================================
// Public Types
// ============================================================================

export interface SyncCycleResult {
  success: boolean
  pulled: {
    conversations: number
    messages: number
  }
  pushed: {
    conversations: number
    messages: number
  }
  conflicts: ConflictRecord[]
  errors: SyncError[]
}

export interface SyncEngineOptions {
  /** Batch size for push operations */
  pushBatchSize?: number
  /** Whether to auto-resolve conflicts */
  autoResolveConflicts?: boolean
}

// ============================================================================
// Internal Types
// ============================================================================

export interface MergeRemoteResult {
  applied: {
    conversations: number
    messages: number
  }
  conflicts: ConflictRecord[]
}

export interface MergeRecordResult {
  applied: boolean
  conflict: ConflictRecord | null
}

export interface EntityTable<T> {
  get: (id: string) => Promise<T | undefined>
  add: (item: T) => Promise<unknown>
  put: (item: T) => Promise<unknown>
  update: (id: string, changes: Partial<T>) => Promise<unknown>
}

export interface MergeEntityResult<T> {
  merged: T
  needsUserResolution: boolean
}

export interface PushChangesResult {
  success: boolean
  counts: {
    conversations: number
    messages: number
  }
  failed: Array<{ id: string; reason: string; serverVersion?: SyncRecord }>
  error?: SyncError
}
