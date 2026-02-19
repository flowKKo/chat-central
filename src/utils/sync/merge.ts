import type { MergeResult, MergeStrategy, SyncFields } from './types'
import type { Conversation, Message } from '@/types'

// ============================================================================
// Merge Strategy Configuration
// ============================================================================

/**
 * Field-level merge strategies for Conversation
 */
export const conversationMergeStrategies: Record<string, MergeStrategy> = {
  // Last-Write-Wins fields
  title: 'lww',
  preview: 'lww',
  messageCount: 'max',
  updatedAt: 'max',
  detailStatus: 'lww',
  detailSyncedAt: 'max',
  url: 'lww',

  // Boolean OR: if favorited anywhere, keep favorited
  isFavorite: 'or',

  // Take earliest favorite time
  favoriteAt: 'min',

  // Array union for tags
  tags: 'union',

  // Soft delete requires both sides to agree (AND)
  deleted: 'and',

  // Sync metadata
  syncVersion: 'max',
  modifiedAt: 'max',
}

/**
 * Field-level merge strategies for Message
 */
export const messageMergeStrategies: Record<string, MergeStrategy> = {
  content: 'lww',
  role: 'lww',

  // Soft delete requires both sides to agree
  deleted: 'and',

  // Sync metadata
  syncVersion: 'max',
  modifiedAt: 'max',
}

// ============================================================================
// Merge Functions
// ============================================================================

type SyncRecord = Record<string, unknown> & Partial<SyncFields> & { modifiedAt?: number }

/**
 * Merge two records using field-level strategies
 */
export function mergeRecords(
  local: SyncRecord,
  remote: SyncRecord,
  strategies: Record<string, MergeStrategy>
): MergeResult {
  const merged: Record<string, unknown> = {}
  const conflicts: string[] = []

  // Get all unique keys from both records
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)])

  // Fields to skip (internal/derived)
  const skipFields = new Set([
    'id',
    'platform',
    'originalId',
    'conversationId',
    'createdAt',
    '_raw',
  ])

  for (const key of allKeys) {
    if (skipFields.has(key)) {
      // Keep local value for identity fields
      merged[key] = local[key] ?? remote[key]
      continue
    }

    const localVal = local[key]
    const remoteVal = remote[key]

    // If values are equal, no merge needed
    if (deepEqual(localVal, remoteVal)) {
      merged[key] = localVal
      continue
    }

    const strategy = strategies[key]

    if (!strategy) {
      // No strategy defined - use LWW as default
      merged[key] = (local.modifiedAt ?? 0) >= (remote.modifiedAt ?? 0) ? localVal : remoteVal
      continue
    }

    switch (strategy) {
      case 'lww':
        // Last-Write-Wins based on modifiedAt
        merged[key] = (local.modifiedAt ?? 0) >= (remote.modifiedAt ?? 0) ? localVal : remoteVal
        break

      case 'or':
        // Boolean OR
        merged[key] = Boolean(localVal) || Boolean(remoteVal)
        break

      case 'and':
        // Boolean AND
        merged[key] = Boolean(localVal) && Boolean(remoteVal)
        break

      case 'union':
        // Array union
        merged[key] = arrayUnion(localVal, remoteVal)
        break

      case 'max':
        // Take maximum value
        merged[key] = Math.max(toNumber(localVal), toNumber(remoteVal))
        break

      case 'min':
        // Take minimum non-null value
        merged[key] = minNonNull(localVal, remoteVal)
        break

      default:
        // Unknown strategy - mark as conflict
        conflicts.push(key)
        merged[key] = localVal // Default to local
    }
  }

  return {
    merged,
    conflicts,
    needsUserResolution: conflicts.length > 0,
  }
}

/**
 * Merge a conversation with remote version
 */
export function mergeConversation(
  local: Conversation,
  remote: Conversation
): MergeResult & { conversation: Conversation } {
  const result = mergeRecords(
    local as unknown as SyncRecord,
    remote as unknown as SyncRecord,
    conversationMergeStrategies
  )

  return {
    ...result,
    conversation: result.merged as unknown as Conversation,
  }
}

/**
 * Merge a message with remote version
 */
export function mergeMessage(local: Message, remote: Message): MergeResult & { message: Message } {
  const result = mergeRecords(
    local as unknown as SyncRecord,
    remote as unknown as SyncRecord,
    messageMergeStrategies
  )

  return {
    ...result,
    message: result.merged as unknown as Message,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Deep equality check for primitive values and arrays
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>)
    const bKeys = Object.keys(b as Record<string, unknown>)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((key) =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    )
  }

  return false
}

/**
 * Union of two arrays, removing duplicates.
 * Uses JSON serialization for value equality (handles objects like tags).
 */
function arrayUnion(a: unknown, b: unknown): unknown[] {
  const arrA = Array.isArray(a) ? a : []
  const arrB = Array.isArray(b) ? b : []
  const seen = new Map<string, unknown>()
  for (const item of [...arrA, ...arrB]) {
    const key = typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)
    if (!seen.has(key)) {
      seen.set(key, item)
    }
  }
  return [...seen.values()]
}

/**
 * Convert value to number, defaulting to 0
 */
function toNumber(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const parsed = Number.parseFloat(val)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

/**
 * Get minimum non-null value
 */
function minNonNull(a: unknown, b: unknown): unknown {
  const numA = a != null ? toNumber(a) : null
  const numB = b != null ? toNumber(b) : null

  if (numA === null && numB === null) return null
  if (numA === null) return b
  if (numB === null) return a
  return numA <= numB ? a : b
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Check if two records have conflicts that need resolution
 */
export function hasConflicts(
  local: SyncRecord,
  remote: SyncRecord,
  strategies: Record<string, MergeStrategy>
): string[] {
  const conflicts: string[] = []
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const skipFields = new Set([
    'id',
    'platform',
    'originalId',
    'conversationId',
    'createdAt',
    '_raw',
  ])

  for (const key of allKeys) {
    if (skipFields.has(key)) continue

    const localVal = local[key]
    const remoteVal = remote[key]

    if (deepEqual(localVal, remoteVal)) continue

    const strategy = strategies[key]
    if (!strategy) {
      conflicts.push(key)
    }
  }

  return conflicts
}
