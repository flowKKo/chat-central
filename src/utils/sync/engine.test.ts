import type {
  ConflictRecord,
  OperationLog,
  PullResult,
  PushResult,
  SyncProvider,
  SyncRecord,
  SyncState,
} from './types'
import type { Conversation, Message } from '@/types'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MockSyncProvider } from './providers/mock'
import { syncCycle, applyConflictResolution, pullOnly, pushOnly } from './engine'
import * as dbModule from '@/utils/db'

// Hoisted mock tables (accessible inside vi.mock factories)
const { mockDbTables } = vi.hoisted(() => ({
  mockDbTables: {
    conversations: {
      get: vi.fn(),
      add: vi.fn(),
      put: vi.fn(),
      update: vi.fn(),
    },
    messages: {
      get: vi.fn(),
      add: vi.fn(),
      put: vi.fn(),
      update: vi.fn(),
    },
    conflicts: {
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
    },
    transaction: vi.fn((_mode: string, _tables: unknown, fn: () => unknown) => fn()),
  },
}))

// Mock merge module
vi.mock('./merge', () => ({
  mergeConversation: vi.fn().mockReturnValue({
    merged: {},
    conflicts: [],
    needsUserResolution: false,
    conversation: {},
  }),
  mergeMessage: vi.fn().mockReturnValue({
    merged: {},
    conflicts: [],
    needsUserResolution: false,
    message: {},
  }),
}))

// Mock the database module
vi.mock('@/utils/db', () => ({
  db: mockDbTables,
  getDirtyConversations: vi.fn(() => []),
  getDirtyMessages: vi.fn(() => []),
  clearDirtyFlags: vi.fn(),
  addConflict: vi.fn(),
  updateSyncState: vi.fn(),
  getSyncState: vi.fn(() => ({
    id: 'global',
    deviceId: 'test-device',
    lastPullAt: null,
    lastPushAt: null,
    remoteCursor: null,
    pendingConflicts: 0,
    status: 'idle',
    lastError: null,
    lastErrorAt: null,
  })),
  getPendingOperations: vi.fn(() => []),
  markOperationsSynced: vi.fn(),
  invalidateSearchIndex: vi.fn(),
}))

// ============================================================================
// Helpers
// ============================================================================

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    originalId: 'orig-1',
    platform: 'claude',
    title: 'Test Conversation',
    preview: 'Preview text',
    messageCount: 5,
    createdAt: 1000,
    updatedAt: 2000,
    url: 'https://example.com',
    isFavorite: false,
    favoriteAt: null,
    tags: [],
    syncedAt: 0,
    detailStatus: 'none',
    detailSyncedAt: null,
    syncVersion: 1,
    modifiedAt: 1000,
    ...overrides,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello',
    createdAt: 1000,
    syncVersion: 1,
    modifiedAt: 1000,
    ...overrides,
  }
}

function makeOperationLog(overrides: Partial<OperationLog> = {}): OperationLog {
  return {
    id: 'op-1',
    entityType: 'conversation',
    entityId: 'conv-1',
    operation: 'update',
    changes: {},
    timestamp: Date.now(),
    synced: false,
    syncedAt: null,
    ...overrides,
  }
}

describe('mockSyncProvider', () => {
  let provider: MockSyncProvider

  beforeEach(() => {
    provider = new MockSyncProvider()
    provider.reset()
  })

  describe('connection', () => {
    it('connects successfully', async () => {
      await provider.connect({ type: 'rest' })
      expect(provider.isConnected()).toBe(true)
    })

    it('disconnects successfully', async () => {
      await provider.connect({ type: 'rest' })
      await provider.disconnect()
      expect(provider.isConnected()).toBe(false)
    })

    it('simulates network error on connect', async () => {
      provider.simulateNetworkError = true
      await expect(provider.connect({ type: 'rest' })).rejects.toThrow('Simulated network error')
    })
  })

  describe('pull', () => {
    beforeEach(async () => {
      await provider.connect({ type: 'rest' })
    })

    it('returns empty records when server is empty', async () => {
      const result = await provider.pull()
      expect(result.success).toBe(true)
      expect(result.records).toHaveLength(0)
      expect(result.hasMore).toBe(false)
    })

    it('returns server records', async () => {
      const testRecord: SyncRecord = {
        id: 'conv_1',
        entityType: 'conversation',
        data: { id: 'conv_1', title: 'Test' },
        syncVersion: 1,
        modifiedAt: Date.now(),
        deleted: false,
      }
      provider.addServerRecords([testRecord])

      const result = await provider.pull()
      expect(result.success).toBe(true)
      expect(result.records).toHaveLength(1)
      expect(result.records[0]?.id).toBe('conv_1')
    })

    it('paginates results', async () => {
      // Add 60 records
      const records: SyncRecord[] = Array.from({ length: 60 }, (_, i) => ({
        id: `conv_${i}`,
        entityType: 'conversation' as const,
        data: { id: `conv_${i}`, title: `Test ${i}` },
        syncVersion: 1,
        modifiedAt: Date.now(),
        deleted: false,
      }))
      provider.addServerRecords(records)

      // First pull
      const result1 = await provider.pull()
      expect(result1.success).toBe(true)
      expect(result1.records).toHaveLength(50)
      expect(result1.hasMore).toBe(true)
      expect(result1.cursor).toBe('50')

      // Second pull
      const result2 = await provider.pull(result1.cursor)
      expect(result2.success).toBe(true)
      expect(result2.records).toHaveLength(10)
      expect(result2.hasMore).toBe(false)
    })

    it('returns error on network failure', async () => {
      provider.simulateNetworkError = true
      const result = await provider.pull()
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('network_error')
    })
  })

  describe('push', () => {
    beforeEach(async () => {
      await provider.connect({ type: 'rest' })
    })

    it('pushes records successfully', async () => {
      const records: SyncRecord[] = [
        {
          id: 'conv_1',
          entityType: 'conversation',
          data: { id: 'conv_1', title: 'Test' },
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ]

      const result = await provider.push(records)
      expect(result.success).toBe(true)
      expect(result.applied).toContain('conv_1')
      expect(result.failed).toHaveLength(0)
    })

    it('stores pushed records on server', async () => {
      const records: SyncRecord[] = [
        {
          id: 'conv_1',
          entityType: 'conversation',
          data: { id: 'conv_1', title: 'Test' },
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ]

      await provider.push(records)
      const serverRecords = provider.getServerRecords()
      expect(serverRecords).toHaveLength(1)
      expect(serverRecords[0]?.id).toBe('conv_1')
    })

    it('simulates conflict', async () => {
      // Add existing record
      provider.addServerRecords([
        {
          id: 'conv_1',
          entityType: 'conversation',
          data: { id: 'conv_1', title: 'Server Title' },
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ])

      provider.simulateConflict = true

      const result = await provider.push([
        {
          id: 'conv_1',
          entityType: 'conversation',
          data: { id: 'conv_1', title: 'Client Title' },
          syncVersion: 2,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ])

      expect(result.success).toBe(true)
      expect(result.applied).toHaveLength(0)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0]?.reason).toBe('conflict')
      expect(result.failed[0]?.serverVersion).toBeDefined()
    })

    it('returns error on network failure', async () => {
      provider.simulateNetworkError = true
      const result = await provider.push([])
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('network_error')
    })
  })

  describe('push history', () => {
    beforeEach(async () => {
      await provider.connect({ type: 'rest' })
    })

    it('tracks push history', async () => {
      const batch1: SyncRecord[] = [
        {
          id: 'conv_1',
          entityType: 'conversation',
          data: {},
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ]
      const batch2: SyncRecord[] = [
        {
          id: 'conv_2',
          entityType: 'conversation',
          data: {},
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ]

      await provider.push(batch1)
      await provider.push(batch2)

      const history = provider.getPushHistory()
      expect(history).toHaveLength(2)
      expect(history[0]?.[0]?.id).toBe('conv_1')
      expect(history[1]?.[0]?.id).toBe('conv_2')
    })
  })
})

// ============================================================================
// Engine function tests
// ============================================================================

function createMockProvider(overrides: Partial<SyncProvider> = {}): SyncProvider {
  return {
    name: 'test-provider',
    type: 'rest',
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    pull: vi.fn<(cursor?: string | null) => Promise<PullResult>>().mockResolvedValue({
      success: true,
      records: [],
      cursor: 'cursor-1',
      hasMore: false,
    }),
    push: vi.fn<(changes: SyncRecord[]) => Promise<PushResult>>().mockResolvedValue({
      success: true,
      applied: [],
      failed: [],
    }),
    ...overrides,
  }
}

function createSyncRecord(overrides: Partial<SyncRecord> = {}): SyncRecord {
  return {
    id: 'rec-1',
    entityType: 'conversation',
    data: { id: 'rec-1', title: 'Test' },
    syncVersion: 1,
    modifiedAt: Date.now(),
    deleted: false,
    ...overrides,
  }
}

describe('syncCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbTables.conversations.get.mockResolvedValue(undefined)
    mockDbTables.conversations.add.mockResolvedValue(undefined)
    mockDbTables.conversations.put.mockResolvedValue(undefined)
    mockDbTables.messages.get.mockResolvedValue(undefined)
    mockDbTables.messages.add.mockResolvedValue(undefined)
    mockDbTables.messages.put.mockResolvedValue(undefined)
    mockDbTables.conflicts.get.mockResolvedValue(undefined)
    mockDbTables.conflicts.update.mockResolvedValue(undefined)
  })

  it('should return success with no changes when provider returns empty', async () => {
    const provider = createMockProvider()

    const result = await syncCycle(provider)

    expect(result.success).toBe(true)
    expect(result.pulled).toEqual({ conversations: 0, messages: 0 })
    expect(result.pushed).toEqual({ conversations: 0, messages: 0 })
    expect(result.conflicts).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('should set sync state to syncing at start', async () => {
    const provider = createMockProvider()

    await syncCycle(provider)

    expect(vi.mocked(dbModule.updateSyncState)).toHaveBeenCalledWith({
      status: 'syncing',
      lastError: null,
    })
  })

  it('should pass cursor from sync state to pull', async () => {
    vi.mocked(dbModule.getSyncState).mockResolvedValue({
      remoteCursor: 'existing-cursor',
    } as SyncState)
    const provider = createMockProvider()

    await syncCycle(provider)

    expect(provider.pull).toHaveBeenCalledWith('existing-cursor')
  })

  it('should pass null cursor when no sync state', async () => {
    vi.mocked(dbModule.getSyncState).mockResolvedValue(undefined)
    const provider = createMockProvider()

    await syncCycle(provider)

    expect(provider.pull).toHaveBeenCalledWith(null)
  })

  it('should return error and set error state when pull fails', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockResolvedValue({
        success: false,
        records: [],
        cursor: null,
        hasMore: false,
        error: { code: 'network_error', message: 'Connection lost', recoverable: true },
      }),
    })

    const result = await syncCycle(provider)

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.code).toBe('network_error')
    expect(vi.mocked(dbModule.updateSyncState)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', lastError: 'Connection lost' })
    )
  })

  it('should update cursor after successful pull', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockResolvedValue({
        success: true,
        records: [],
        cursor: 'new-cursor-123',
        hasMore: false,
      }),
    })

    await syncCycle(provider)

    expect(vi.mocked(dbModule.updateSyncState)).toHaveBeenCalledWith(
      expect.objectContaining({ remoteCursor: 'new-cursor-123' })
    )
  })

  it('should paginate pull when hasMore is true', async () => {
    const pullFn = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        records: [createSyncRecord({ id: 'r1' })],
        cursor: 'page-2',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        success: true,
        records: [createSyncRecord({ id: 'r2' })],
        cursor: 'page-3',
        hasMore: false,
      })

    const provider = createMockProvider({ pull: pullFn })

    await syncCycle(provider)

    expect(pullFn).toHaveBeenCalledTimes(2)
    expect(pullFn).toHaveBeenNthCalledWith(1, null)
    expect(pullFn).toHaveBeenNthCalledWith(2, 'page-2')
  })

  it('should push dirty conversations and messages', async () => {
    const dirtyConv = makeConversation({
      id: 'c1',
      title: 'Dirty',
      syncVersion: 2,
      modifiedAt: 1000,
    })
    const dirtyMsg = makeMessage({ id: 'm1', content: 'Hello', syncVersion: 1, modifiedAt: 2000 })

    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([dirtyConv])
    vi.mocked(dbModule.getDirtyMessages).mockResolvedValue([dirtyMsg])

    const pushFn = vi.fn().mockResolvedValue({
      success: true,
      applied: ['c1', 'm1'],
      failed: [],
    })
    const provider = createMockProvider({ push: pushFn })

    const result = await syncCycle(provider)

    expect(pushFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'c1', entityType: 'conversation' }),
        expect.objectContaining({ id: 'm1', entityType: 'message' }),
      ])
    )
    expect(result.pushed).toEqual({ conversations: 1, messages: 1 })
  })

  it('should clear dirty flags after successful push', async () => {
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([makeConversation({ id: 'c1' })])
    vi.mocked(dbModule.getDirtyMessages).mockResolvedValue([makeMessage({ id: 'm1' })])

    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({ success: true, applied: ['c1', 'm1'], failed: [] }),
    })

    await syncCycle(provider)

    expect(vi.mocked(dbModule.clearDirtyFlags)).toHaveBeenCalledWith(['c1'], ['m1'])
  })

  it('should not fail entire sync when push fails but pull succeeds', async () => {
    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({
        success: false,
        applied: [],
        failed: [],
        error: { code: 'server_error', message: 'Server down', recoverable: true },
      }),
    })

    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([makeConversation({ id: 'c1' })])

    const result = await syncCycle(provider)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.code).toBe('server_error')
  })

  it('should catch unexpected errors and set error state', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockRejectedValue(new Error('Unexpected crash')),
    })

    const result = await syncCycle(provider)

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toEqual({
      code: 'server_error',
      message: 'Unexpected crash',
      recoverable: true,
    })
    expect(vi.mocked(dbModule.updateSyncState)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', lastError: 'Unexpected crash' })
    )
  })

  it('should handle non-Error thrown values', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockRejectedValue('string error'),
    })

    const result = await syncCycle(provider)

    expect(result.errors[0]!.message).toBe('Unknown sync error')
  })

  it('should use custom pushBatchSize option', async () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeConversation({ id: `c${i}`, modifiedAt: i })
    )
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue(records)

    const pushFn = vi.fn().mockResolvedValue({ success: true, applied: [], failed: [] })
    const provider = createMockProvider({ push: pushFn })

    await syncCycle(provider, { pushBatchSize: 2 })

    // 5 conversations + 0 messages = 5 records, batch size 2 → 3 batches
    expect(pushFn).toHaveBeenCalledTimes(3)
  })

  it('should mark operations as synced after push', async () => {
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([makeConversation({ id: 'c1' })])
    vi.mocked(dbModule.getPendingOperations).mockResolvedValue([
      makeOperationLog({ id: 'op1', entityId: 'c1' }),
      makeOperationLog({ id: 'op2', entityId: 'c-other' }),
    ])

    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({ success: true, applied: ['c1'], failed: [] }),
    })

    await syncCycle(provider)

    expect(vi.mocked(dbModule.markOperationsSynced)).toHaveBeenCalledWith(['op1'])
  })

  it('should set idle status when no conflicts', async () => {
    const provider = createMockProvider()

    await syncCycle(provider)

    expect(vi.mocked(dbModule.updateSyncState)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'idle' })
    )
  })

  it('should handle push conflict with server version', async () => {
    const serverVersion = createSyncRecord({
      id: 'c1',
      entityType: 'conversation',
    })

    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([makeConversation({ id: 'c1' })])

    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({
        success: true,
        applied: [],
        failed: [
          {
            id: 'c1',
            reason: 'conflict',
            message: 'Version mismatch',
            serverVersion,
          },
        ],
      }),
    })

    const result = await syncCycle(provider)

    // The merge was attempted for the conflicting record
    expect(result.pushed.conversations).toBe(0)
  })
})

describe('applyConflictResolution', () => {
  const mockConflict: ConflictRecord = {
    id: 'conflict-1',
    entityType: 'conversation',
    entityId: 'c1',
    localVersion: { id: 'c1', title: 'Local Title' },
    remoteVersion: { id: 'c1', title: 'Remote Title' },
    conflictFields: ['title'],
    resolution: 'pending',
    resolvedAt: null,
    createdAt: Date.now(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDbTables.conversations.put.mockResolvedValue(undefined)
    mockDbTables.messages.put.mockResolvedValue(undefined)
    mockDbTables.conflicts.get.mockResolvedValue(undefined)
    mockDbTables.conflicts.update.mockResolvedValue(undefined)
  })

  it('should throw when conflict not found', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(undefined)

    await expect(applyConflictResolution('missing', 'local')).rejects.toThrow(
      'Conflict not found: missing'
    )
  })

  it('should apply local version for conversation', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(mockConflict)

    await applyConflictResolution('conflict-1', 'local')

    expect(mockDbTables.conversations.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c1',
        title: 'Local Title',
        dirty: true, // local resolution → still needs to push
      })
    )
    expect(mockDbTables.conflicts.update).toHaveBeenCalledWith(
      'conflict-1',
      expect.objectContaining({ resolution: 'local' })
    )
  })

  it('should apply remote version for conversation', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(mockConflict)

    await applyConflictResolution('conflict-1', 'remote')

    expect(mockDbTables.conversations.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c1',
        title: 'Remote Title',
        dirty: false, // remote → no push needed
      })
    )
  })

  it('should apply merged data when provided', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(mockConflict)

    const mergedData = { id: 'c1', title: 'Merged Title' }
    await applyConflictResolution('conflict-1', 'merged', mergedData)

    expect(mockDbTables.conversations.put).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Merged Title' })
    )
  })

  it('should throw when merged resolution has no data', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(mockConflict)

    await expect(applyConflictResolution('conflict-1', 'merged')).rejects.toThrow(
      'No data to apply for resolution'
    )
  })

  it('should apply resolution for message entity type', async () => {
    const msgConflict: ConflictRecord = {
      ...mockConflict,
      entityType: 'message',
      entityId: 'm1',
      localVersion: { id: 'm1', content: 'Local' },
      remoteVersion: { id: 'm1', content: 'Remote' },
    }
    mockDbTables.conflicts.get.mockResolvedValue(msgConflict)

    await applyConflictResolution('conflict-1', 'remote')

    expect(mockDbTables.messages.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1', content: 'Remote', dirty: false })
    )
  })

  it('should mark conflict as resolved with timestamp', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(mockConflict)

    await applyConflictResolution('conflict-1', 'local')

    expect(mockDbTables.conflicts.update).toHaveBeenCalledWith('conflict-1', {
      resolution: 'local',
      resolvedAt: expect.any(Number),
    })
  })
})

describe('pullOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbTables.conversations.get.mockResolvedValue(undefined)
    mockDbTables.conversations.add.mockResolvedValue(undefined)
    mockDbTables.messages.get.mockResolvedValue(undefined)
    mockDbTables.messages.add.mockResolvedValue(undefined)
  })

  it('should return success with 0 pulled when no changes', async () => {
    const provider = createMockProvider()

    const result = await pullOnly(provider)

    expect(result.success).toBe(true)
    expect(result.pulled).toBe(0)
  })

  it('should use cursor from sync state', async () => {
    vi.mocked(dbModule.getSyncState).mockResolvedValue({ remoteCursor: 'cursor-abc' } as SyncState)
    const provider = createMockProvider()

    await pullOnly(provider)

    expect(provider.pull).toHaveBeenCalledWith('cursor-abc')
  })

  it('should return error when pull fails', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockResolvedValue({
        success: false,
        records: [],
        cursor: null,
        hasMore: false,
        error: {
          code: 'auth_failed',
          message: 'Token expired',
          recoverable: false,
        },
      }),
    })

    const result = await pullOnly(provider)

    expect(result.success).toBe(false)
    expect(result.pulled).toBe(0)
    expect(result.error).toEqual(expect.objectContaining({ code: 'auth_failed' }))
  })

  it('should update cursor after successful pull', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockResolvedValue({
        success: true,
        records: [],
        cursor: 'new-cursor',
        hasMore: false,
      }),
    })

    await pullOnly(provider)

    expect(vi.mocked(dbModule.updateSyncState)).toHaveBeenCalledWith(
      expect.objectContaining({ remoteCursor: 'new-cursor' })
    )
  })

  it('should count pulled records from merge result', async () => {
    const records = [
      createSyncRecord({ id: 'c1', entityType: 'conversation' }),
      createSyncRecord({ id: 'm1', entityType: 'message' }),
    ]

    const provider = createMockProvider({
      pull: vi.fn().mockResolvedValue({
        success: true,
        records,
        cursor: 'c1',
        hasMore: false,
      }),
    })

    const result = await pullOnly(provider)

    expect(result.success).toBe(true)
    expect(result.pulled).toBe(2)
  })

  it('should catch unexpected errors', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockRejectedValue(new Error('Network failure')),
    })

    const result = await pullOnly(provider)

    expect(result.success).toBe(false)
    expect(result.error).toEqual({
      code: 'network_error',
      message: 'Network failure',
      recoverable: true,
    })
  })

  it('should handle non-Error thrown values', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockRejectedValue(42),
    })

    const result = await pullOnly(provider)

    expect(result.error?.message).toBe('Pull failed')
  })
})

describe('pushOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return success with 0 pushed when nothing dirty', async () => {
    const provider = createMockProvider()

    const result = await pushOnly(provider)

    expect(result.success).toBe(true)
    expect(result.pushed).toBe(0)
  })

  it('should push dirty records and return count', async () => {
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([makeConversation({ id: 'c1' })])
    vi.mocked(dbModule.getDirtyMessages).mockResolvedValue([makeMessage({ id: 'm1' })])

    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({ success: true, applied: ['c1', 'm1'], failed: [] }),
    })

    const result = await pushOnly(provider)

    expect(result.success).toBe(true)
    expect(result.pushed).toBe(2)
  })

  it('should return error when push fails', async () => {
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([makeConversation({ id: 'c1' })])

    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({
        success: false,
        applied: [],
        failed: [],
        error: {
          code: 'quota_exceeded',
          message: 'Storage full',
          recoverable: false,
        },
      }),
    })

    const result = await pushOnly(provider)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('quota_exceeded')
  })

  it('should handle push throwing an exception', async () => {
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([makeConversation({ id: 'c1' })])

    const provider = createMockProvider({
      push: vi.fn().mockRejectedValue(new Error('Connection reset')),
    })

    const result = await pushOnly(provider)

    expect(result.success).toBe(false)
    expect(result.error).toEqual({
      code: 'network_error',
      message: 'Connection reset',
      recoverable: true,
    })
  })
})
