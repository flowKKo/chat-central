import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pushChanges, toSyncRecord } from './push'
import type { PushResult, SyncProvider, SyncRecord } from '../types'
import * as dbModule from '@/utils/db'

vi.mock('@/utils/db', () => ({
  getDirtyConversations: vi.fn(() => []),
  getDirtyMessages: vi.fn(() => []),
  clearDirtyFlags: vi.fn(),
  getPendingOperations: vi.fn(() => []),
  markOperationsSynced: vi.fn(),
}))

function createMockProvider(overrides: Partial<SyncProvider> = {}): SyncProvider {
  return {
    name: 'test-provider',
    type: 'rest',
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    pull: vi.fn().mockResolvedValue({ success: true, records: [], cursor: null, hasMore: false }),
    push: vi.fn<(changes: SyncRecord[]) => Promise<PushResult>>().mockResolvedValue({
      success: true,
      applied: [],
      failed: [],
    }),
    ...overrides,
  }
}

describe('toSyncRecord', () => {
  it('should convert a conversation record', () => {
    const record = { id: 'c1', title: 'Test', syncVersion: 2, modifiedAt: 5000, deleted: false }
    const result = toSyncRecord('conversation', record)
    expect(result).toEqual({
      id: 'c1',
      entityType: 'conversation',
      data: record,
      syncVersion: 2,
      modifiedAt: 5000,
      deleted: false,
    })
  })

  it('should convert a message record', () => {
    const record = { id: 'm1', content: 'Hello', syncVersion: 1, modifiedAt: 3000 }
    const result = toSyncRecord('message', record)
    expect(result.entityType).toBe('message')
    expect(result.id).toBe('m1')
    expect(result.deleted).toBe(false) // default
  })

  it('should default syncVersion to 1 when missing', () => {
    const record = { id: 'c1', title: 'No version' }
    const result = toSyncRecord('conversation', record)
    expect(result.syncVersion).toBe(1)
  })

  it('should default deleted to false when missing', () => {
    const record = { id: 'c1' }
    const result = toSyncRecord('conversation', record)
    expect(result.deleted).toBe(false)
  })

  it('should handle deleted records', () => {
    const record = { id: 'c1', deleted: true, syncVersion: 3, modifiedAt: 9000 }
    const result = toSyncRecord('conversation', record)
    expect(result.deleted).toBe(true)
  })
})

describe('pushChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return success with zero counts when nothing dirty', async () => {
    const provider = createMockProvider()
    const result = await pushChanges(provider, 50)
    expect(result.success).toBe(true)
    expect(result.counts).toEqual({ conversations: 0, messages: 0 })
    expect(result.failed).toEqual([])
  })

  it('should push dirty conversations', async () => {
    const conv = { id: 'c1', title: 'Dirty', syncVersion: 1, modifiedAt: 1000 }
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([conv as never])

    const pushFn = vi.fn().mockResolvedValue({ success: true, applied: ['c1'], failed: [] })
    const provider = createMockProvider({ push: pushFn })

    const result = await pushChanges(provider, 50)
    expect(result.success).toBe(true)
    expect(result.counts.conversations).toBe(1)
    expect(pushFn).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'c1', entityType: 'conversation' })])
    )
  })

  it('should push dirty messages', async () => {
    const msg = { id: 'm1', content: 'Hello', syncVersion: 1, modifiedAt: 2000 }
    vi.mocked(dbModule.getDirtyMessages).mockResolvedValue([msg as never])

    const pushFn = vi.fn().mockResolvedValue({ success: true, applied: ['m1'], failed: [] })
    const provider = createMockProvider({ push: pushFn })

    const result = await pushChanges(provider, 50)
    expect(result.success).toBe(true)
    expect(result.counts.messages).toBe(1)
  })

  it('should push in batches respecting batch size', async () => {
    const convs = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      syncVersion: 1,
      modifiedAt: i,
    }))
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue(convs as never)

    const pushFn = vi.fn().mockResolvedValue({ success: true, applied: [], failed: [] })
    const provider = createMockProvider({ push: pushFn })

    await pushChanges(provider, 2)
    // 5 records, batch size 2 → 3 batches
    expect(pushFn).toHaveBeenCalledTimes(3)
  })

  it('should clear dirty flags for successful pushes', async () => {
    const conv = { id: 'c1', syncVersion: 1, modifiedAt: 1000 }
    const msg = { id: 'm1', syncVersion: 1, modifiedAt: 2000 }
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([conv as never])
    vi.mocked(dbModule.getDirtyMessages).mockResolvedValue([msg as never])

    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({ success: true, applied: ['c1', 'm1'], failed: [] }),
    })

    await pushChanges(provider, 50)
    expect(vi.mocked(dbModule.clearDirtyFlags)).toHaveBeenCalledWith(['c1'], ['m1'])
  })

  it('should mark operations as synced for pushed entities', async () => {
    const conv = { id: 'c1', syncVersion: 1, modifiedAt: 1000 }
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([conv as never])
    vi.mocked(dbModule.getPendingOperations).mockResolvedValue([
      {
        id: 'op1',
        entityId: 'c1',
        entityType: 'conversation',
        operation: 'update',
        changes: {},
        timestamp: 1000,
        synced: false,
        syncedAt: null,
      },
      {
        id: 'op2',
        entityId: 'c-other',
        entityType: 'conversation',
        operation: 'update',
        changes: {},
        timestamp: 2000,
        synced: false,
        syncedAt: null,
      },
    ])

    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({ success: true, applied: ['c1'], failed: [] }),
    })

    await pushChanges(provider, 50)
    expect(vi.mocked(dbModule.markOperationsSynced)).toHaveBeenCalledWith(['op1'])
  })

  it('should return error when push fails', async () => {
    const conv = { id: 'c1', syncVersion: 1, modifiedAt: 1000 }
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([conv as never])

    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({
        success: false,
        applied: [],
        failed: [],
        error: { code: 'server_error', message: 'Server down', recoverable: true },
      }),
    })

    const result = await pushChanges(provider, 50)
    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('server_error')
  })

  it('should track failed records', async () => {
    const conv = { id: 'c1', syncVersion: 1, modifiedAt: 1000 }
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([conv as never])

    const provider = createMockProvider({
      push: vi.fn().mockResolvedValue({
        success: true,
        applied: [],
        failed: [{ id: 'c1', reason: 'conflict', message: 'Version mismatch' }],
      }),
    })

    const result = await pushChanges(provider, 50)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]!.id).toBe('c1')
    expect(result.failed[0]!.reason).toBe('conflict')
  })

  it('should handle network exception during push', async () => {
    const conv = { id: 'c1', syncVersion: 1, modifiedAt: 1000 }
    vi.mocked(dbModule.getDirtyConversations).mockResolvedValue([conv as never])

    const provider = createMockProvider({
      push: vi.fn().mockRejectedValue(new Error('Connection reset')),
    })

    const result = await pushChanges(provider, 50)
    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('network_error')
    expect(result.error?.message).toBe('Connection reset')
  })
})
