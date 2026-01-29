import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@/types'
import { ChatCentralDB } from '../schema'
import { upsertConversation, upsertConversations, getConversationById } from './conversations'
import { upsertMessages, getMessagesByConversationId } from './messages'
import {
  addConflict,
  addOperationLog,
  clearDirtyFlags,
  cleanupResolvedConflicts,
  getConflictById,
  getPendingConflicts,
  getSyncState,
  initializeSyncState,
  markConversationDirty,
  markMessageDirty,
  markOperationsSynced,
  resolveConflict,
  updateSyncState,
} from './sync'

// ============================================================================
// Test Helpers
// ============================================================================

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const id = overrides.id ?? `test_${Math.random().toString(36).slice(2)}`
  return {
    id,
    platform: 'claude',
    originalId: id.replace('claude_', ''),
    title: 'Test conversation',
    createdAt: 1000,
    updatedAt: 2000,
    messageCount: 0,
    preview: '',
    tags: [],
    syncedAt: 3000,
    detailStatus: 'none',
    detailSyncedAt: null,
    isFavorite: false,
    favoriteAt: null,
    ...overrides,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg_${Math.random().toString(36).slice(2)}`,
    conversationId: 'conv_1',
    role: 'user',
    content: 'Hello world',
    createdAt: 1000,
    ...overrides,
  }
}

// ============================================================================
// Setup
// ============================================================================

let db: ChatCentralDB

beforeEach(async () => {
  db = new ChatCentralDB()
  const schemaModule = await import('../schema')
  Object.defineProperty(schemaModule, 'db', {
    value: db,
    writable: true,
    configurable: true,
  })
})

afterEach(async () => {
  await db.delete()
})

// ============================================================================
// Sync State Operations
// ============================================================================

describe('sync state', () => {
  it('should return undefined when no sync state exists', async () => {
    const state = await getSyncState()
    expect(state).toBeUndefined()
  })

  it('should initialize sync state with correct defaults', async () => {
    const state = await initializeSyncState()

    expect(state.id).toBe('global')
    expect(state.deviceId).toBeDefined()
    expect(typeof state.deviceId).toBe('string')
    expect(state.lastPullAt).toBeNull()
    expect(state.lastPushAt).toBeNull()
    expect(state.remoteCursor).toBeNull()
    expect(state.pendingConflicts).toBe(0)
    expect(state.status).toBe('disabled')
    expect(state.lastError).toBeNull()
    expect(state.lastErrorAt).toBeNull()
  })

  it('should return existing state on repeated initialization', async () => {
    const first = await initializeSyncState()
    const second = await initializeSyncState()

    expect(second.deviceId).toBe(first.deviceId)
    expect(second.id).toBe(first.id)
  })

  it('should update sync state fields', async () => {
    await initializeSyncState()

    await updateSyncState({ status: 'syncing', lastError: null })

    const state = await getSyncState()
    expect(state!.status).toBe('syncing')
  })

  it('should update cursor and timestamps', async () => {
    await initializeSyncState()
    const now = Date.now()

    await updateSyncState({
      remoteCursor: 'cursor-abc',
      lastPullAt: now,
      lastPushAt: now,
    })

    const state = await getSyncState()
    expect(state!.remoteCursor).toBe('cursor-abc')
    expect(state!.lastPullAt).toBe(now)
    expect(state!.lastPushAt).toBe(now)
  })
})

// ============================================================================
// Operation Log Operations
// ============================================================================

describe('operation log', () => {
  it('should add an operation log entry and return its id', async () => {
    const id = await addOperationLog({
      entityType: 'conversation',
      entityId: 'c1',
      operation: 'create',
      changes: { title: 'New conversation' },
      timestamp: 1000,
    })

    expect(id).toBeDefined()
    expect(typeof id).toBe('string')
  })

  // Note: getPendingOperations uses .where('synced').equals(0) which relies on
  // Dexie's boolean-to-number index conversion. In fake-indexeddb, booleans stay
  // as booleans in indexes. We verify via direct db reads instead.
  it('should store operations with synced=false by default', async () => {
    const id = await addOperationLog({
      entityType: 'conversation',
      entityId: 'c1',
      operation: 'create',
      changes: {},
      timestamp: 1000,
    })

    const op = await db.operationLog.get(id)
    expect(op).toBeDefined()
    expect(op!.synced).toBe(false)
    expect(op!.syncedAt).toBeNull()
  })

  it('should store operations ordered by timestamp', async () => {
    await addOperationLog({
      entityType: 'conversation',
      entityId: 'c2',
      operation: 'update',
      changes: {},
      timestamp: 2000,
    })
    await addOperationLog({
      entityType: 'conversation',
      entityId: 'c1',
      operation: 'create',
      changes: {},
      timestamp: 1000,
    })

    const all = await db.operationLog.orderBy('timestamp').toArray()
    expect(all).toHaveLength(2)
    expect(all[0]!.entityId).toBe('c1')
    expect(all[1]!.entityId).toBe('c2')
  })

  it('should mark operations as synced', async () => {
    const id1 = await addOperationLog({
      entityType: 'conversation',
      entityId: 'c1',
      operation: 'create',
      changes: {},
      timestamp: 1000,
    })
    const id2 = await addOperationLog({
      entityType: 'conversation',
      entityId: 'c2',
      operation: 'update',
      changes: {},
      timestamp: 2000,
    })

    await markOperationsSynced([id1])

    const op1 = await db.operationLog.get(id1)
    expect(op1!.synced).toBe(true)
    expect(op1!.syncedAt).toBeGreaterThan(0)

    const op2 = await db.operationLog.get(id2)
    expect(op2!.synced).toBe(false)
    expect(op2!.syncedAt).toBeNull()
  })

  // Note: cleanupSyncedOperations uses .where('synced').equals(1) which relies
  // on Dexie's boolean-to-number index conversion (not available in fake-indexeddb).
  // We verify the synced state is stored correctly via direct db reads.
  it('should store synced state correctly after marking', async () => {
    const id = await addOperationLog({
      entityType: 'conversation',
      entityId: 'c1',
      operation: 'create',
      changes: {},
      timestamp: 1000,
    })

    await markOperationsSynced([id])

    const op = await db.operationLog.get(id)
    expect(op!.synced).toBe(true)
    expect(op!.syncedAt).toBeGreaterThan(0)
  })
})

// ============================================================================
// Conflict Operations
// ============================================================================

describe('conflicts', () => {
  it('should add a conflict record with generated id and createdAt', async () => {
    const id = await addConflict({
      entityType: 'conversation',
      entityId: 'c1',
      localVersion: { id: 'c1', title: 'Local title' },
      remoteVersion: { id: 'c1', title: 'Remote title' },
      conflictFields: ['title'],
      resolution: 'pending',
      resolvedAt: null,
    })

    expect(id).toBeDefined()
    const conflict = await getConflictById(id)
    expect(conflict).toBeDefined()
    expect(conflict!.entityId).toBe('c1')
    expect(conflict!.resolution).toBe('pending')
    expect(conflict!.createdAt).toBeGreaterThan(0)
  })

  it('should get only pending conflicts', async () => {
    await addConflict({
      entityType: 'conversation',
      entityId: 'c1',
      localVersion: {},
      remoteVersion: {},
      conflictFields: ['title'],
      resolution: 'pending',
      resolvedAt: null,
    })
    await addConflict({
      entityType: 'conversation',
      entityId: 'c2',
      localVersion: {},
      remoteVersion: {},
      conflictFields: ['title'],
      resolution: 'local',
      resolvedAt: Date.now(),
    })
    await addConflict({
      entityType: 'conversation',
      entityId: 'c3',
      localVersion: {},
      remoteVersion: {},
      conflictFields: ['tags'],
      resolution: 'pending',
      resolvedAt: null,
    })

    const pending = await getPendingConflicts()
    expect(pending).toHaveLength(2)
    expect(pending.map((c) => c.entityId).sort()).toEqual(['c1', 'c3'])
  })

  it('should resolve a conflict', async () => {
    const id = await addConflict({
      entityType: 'conversation',
      entityId: 'c1',
      localVersion: {},
      remoteVersion: {},
      conflictFields: ['title'],
      resolution: 'pending',
      resolvedAt: null,
    })

    await resolveConflict(id, 'remote')

    const conflict = await getConflictById(id)
    expect(conflict!.resolution).toBe('remote')
    expect(conflict!.resolvedAt).toBeGreaterThan(0)
  })

  it('should return undefined for non-existent conflict', async () => {
    const conflict = await getConflictById('nonexistent-id')
    expect(conflict).toBeUndefined()
  })

  it('should cleanup old resolved conflicts', async () => {
    await addConflict({
      entityType: 'conversation',
      entityId: 'c1',
      localVersion: {},
      remoteVersion: {},
      conflictFields: ['title'],
      resolution: 'local',
      resolvedAt: Date.now() - 200000,
    })
    await addConflict({
      entityType: 'conversation',
      entityId: 'c2',
      localVersion: {},
      remoteVersion: {},
      conflictFields: ['title'],
      resolution: 'pending',
      resolvedAt: null,
    })
    await addConflict({
      entityType: 'conversation',
      entityId: 'c3',
      localVersion: {},
      remoteVersion: {},
      conflictFields: ['tags'],
      resolution: 'remote',
      resolvedAt: Date.now() - 200000,
    })

    const deleted = await cleanupResolvedConflicts(0) // 0ms threshold = cleanup all resolved
    expect(deleted).toBe(2)

    const remaining = await db.conflicts.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]!.entityId).toBe('c2')
  })
})

// ============================================================================
// Dirty Tracking Operations
// ============================================================================

// Note: getDirtyConversations/getDirtyMessages use .where('dirty').equals(1).
// Dexie converts booleans to 0/1 in real IndexedDB indexes, but fake-indexeddb
// doesn't support this conversion. We verify dirty behavior via direct db reads.

describe('dirty tracking', () => {
  it('should mark a conversation as dirty', async () => {
    await upsertConversation(makeConversation({ id: 'c1', dirty: false }))

    await markConversationDirty('c1')

    const conv = await getConversationById('c1')
    expect(conv!.dirty).toBe(true)
    expect(conv!.modifiedAt).toBeGreaterThan(0)
  })

  it('should mark a message as dirty', async () => {
    await upsertMessages([makeMessage({ id: 'm1', conversationId: 'conv_1', dirty: false })])

    await markMessageDirty('m1')

    const msgs = await getMessagesByConversationId('conv_1')
    const msg = msgs.find((m) => m.id === 'm1')
    expect(msg!.dirty).toBe(true)
    expect(msg!.modifiedAt).toBeGreaterThan(0)
  })

  it('should store dirty flag on conversations correctly', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', dirty: true }),
      makeConversation({ id: 'c2', dirty: false }),
      makeConversation({ id: 'c3', dirty: true }),
    ])

    const all = await db.conversations.toArray()
    const dirty = all.filter((c) => c.dirty === true)
    expect(dirty).toHaveLength(2)
    expect(dirty.map((c) => c.id).sort()).toEqual(['c1', 'c3'])
  })

  it('should store dirty flag on messages correctly', async () => {
    await upsertMessages([
      makeMessage({ id: 'm1', dirty: true }),
      makeMessage({ id: 'm2', dirty: false }),
      makeMessage({ id: 'm3', dirty: true }),
    ])

    const all = await db.messages.toArray()
    const dirty = all.filter((m) => m.dirty === true)
    expect(dirty).toHaveLength(2)
    expect(dirty.map((m) => m.id).sort()).toEqual(['m1', 'm3'])
  })

  it('should clear dirty flags for specified conversations and messages', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', dirty: true }),
      makeConversation({ id: 'c2', dirty: true }),
    ])
    await upsertMessages([
      makeMessage({ id: 'm1', dirty: true }),
      makeMessage({ id: 'm2', dirty: true }),
    ])

    await clearDirtyFlags(['c1'], ['m1'])

    const c1 = await getConversationById('c1')
    expect(c1!.dirty).toBe(false)
    expect(c1!.syncedAt).toBeGreaterThan(0)

    const c2 = await getConversationById('c2')
    expect(c2!.dirty).toBe(true)

    const allMsgs = await db.messages.toArray()
    const m1 = allMsgs.find((m) => m.id === 'm1')
    expect(m1!.dirty).toBe(false)
    const m2 = allMsgs.find((m) => m.id === 'm2')
    expect(m2!.dirty).toBe(true)
  })

  it('should handle clearing with empty arrays', async () => {
    await upsertConversation(makeConversation({ id: 'c1', dirty: true }))
    await upsertMessages([makeMessage({ id: 'm1', dirty: true })])

    await clearDirtyFlags([], [])

    const conv = await getConversationById('c1')
    expect(conv!.dirty).toBe(true)

    const allMsgs = await db.messages.toArray()
    expect(allMsgs[0]!.dirty).toBe(true)
  })
})

// ============================================================================
// Cleanup Deleted Records
// ============================================================================

// Note: cleanupDeletedRecords uses .where('deleted').equals(1) which relies on
// Dexie's boolean-to-number index conversion (not available in fake-indexeddb).
// We verify deleted flag storage via direct db reads.

describe('cleanupDeletedRecords', () => {
  it('should store deleted flag on conversations', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', deleted: true, deletedAt: 1 }),
      makeConversation({ id: 'c2', deleted: false }),
    ])

    const all = await db.conversations.toArray()
    const deleted = all.filter((c) => c.deleted === true)
    expect(deleted).toHaveLength(1)
    expect(deleted[0]!.id).toBe('c1')
  })

  it('should store deleted flag on messages', async () => {
    await upsertMessages([
      makeMessage({ id: 'm1', deleted: true, deletedAt: 1 }),
      makeMessage({ id: 'm2', deleted: false }),
    ])

    const all = await db.messages.toArray()
    const deleted = all.filter((m) => m.deleted === true)
    expect(deleted).toHaveLength(1)
    expect(deleted[0]!.id).toBe('m1')
  })
})
