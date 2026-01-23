import type { SyncRecord } from './types'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MockSyncProvider } from './providers/mock'

// Mock the database module
vi.mock('@/utils/db', () => ({
  db: {
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
      add: vi.fn(),
    },
    transaction: vi.fn((_, __, callback) => callback()),
  },
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
}))

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
