import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findConflictFields, mergeRemoteChanges } from './merge'
import type { SyncRecord } from '../types'

// Hoisted mock tables
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

vi.mock('../merge', () => ({
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

vi.mock('@/utils/db', () => ({
  db: mockDbTables,
  addConflict: vi.fn(),
  invalidateSearchIndex: vi.fn(),
}))

function makeSyncRecord(overrides: Partial<SyncRecord> = {}): SyncRecord {
  return {
    id: 'rec-1',
    entityType: 'conversation',
    data: { id: 'rec-1', title: 'Remote' },
    syncVersion: 1,
    modifiedAt: Date.now(),
    deleted: false,
    ...overrides,
  }
}

describe('findConflictFields', () => {
  it('should return empty array when objects are identical', () => {
    const obj = { id: 'c1', title: 'Same', tags: ['a'] }
    expect(findConflictFields(obj, { ...obj })).toEqual([])
  })

  it('should detect differing fields', () => {
    const local = { id: 'c1', title: 'Local', content: 'same' }
    const remote = { id: 'c1', title: 'Remote', content: 'same' }
    const fields = findConflictFields(local, remote)
    expect(fields).toEqual(['title'])
  })

  it('should skip sync metadata fields', () => {
    const local = {
      id: 'c1',
      syncedAt: 1000,
      dirty: true,
      syncVersion: 1,
      modifiedAt: 500,
      title: 'Same',
    }
    const remote = {
      id: 'c1',
      syncedAt: 2000,
      dirty: false,
      syncVersion: 2,
      modifiedAt: 600,
      title: 'Same',
    }
    expect(findConflictFields(local, remote)).toEqual([])
  })

  it('should detect fields only in one side', () => {
    const local = { id: 'c1', title: 'Same' }
    const remote = { id: 'c1', title: 'Same', summary: 'New field' }
    const fields = findConflictFields(local, remote)
    expect(fields).toEqual(['summary'])
  })

  it('should detect array differences', () => {
    const local = { id: 'c1', tags: ['a', 'b'] }
    const remote = { id: 'c1', tags: ['a', 'c'] }
    const fields = findConflictFields(local, remote)
    expect(fields).toEqual(['tags'])
  })

  it('should detect nested object differences via JSON comparison', () => {
    const local = { id: 'c1', meta: { key: 'val1' } }
    const remote = { id: 'c1', meta: { key: 'val2' } }
    const fields = findConflictFields(local, remote)
    expect(fields).toEqual(['meta'])
  })
})

describe('mergeRemoteChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbTables.conversations.get.mockResolvedValue(undefined)
    mockDbTables.conversations.add.mockResolvedValue(undefined)
    mockDbTables.conversations.put.mockResolvedValue(undefined)
    mockDbTables.messages.get.mockResolvedValue(undefined)
    mockDbTables.messages.add.mockResolvedValue(undefined)
    mockDbTables.messages.put.mockResolvedValue(undefined)
  })

  it('should return zero counts for empty records', async () => {
    const result = await mergeRemoteChanges([], true)
    expect(result.applied).toEqual({ conversations: 0, messages: 0 })
    expect(result.conflicts).toEqual([])
  })

  it('should add new conversation record', async () => {
    const record = makeSyncRecord({ id: 'c1', entityType: 'conversation' })
    mockDbTables.conversations.get.mockResolvedValue(undefined)

    const result = await mergeRemoteChanges([record], true)
    expect(result.applied.conversations).toBe(1)
    expect(mockDbTables.conversations.add).toHaveBeenCalledWith(
      expect.objectContaining({ dirty: false })
    )
  })

  it('should add new message record', async () => {
    const record = makeSyncRecord({
      id: 'm1',
      entityType: 'message',
      data: { id: 'm1', content: 'Hi' },
    })
    mockDbTables.messages.get.mockResolvedValue(undefined)

    const result = await mergeRemoteChanges([record], true)
    expect(result.applied.messages).toBe(1)
    expect(mockDbTables.messages.add).toHaveBeenCalled()
  })

  it('should overwrite local non-dirty conversation', async () => {
    const record = makeSyncRecord({ id: 'c1', entityType: 'conversation' })
    mockDbTables.conversations.get.mockResolvedValue({ id: 'c1', title: 'Old', dirty: false })

    const result = await mergeRemoteChanges([record], true)
    expect(result.applied.conversations).toBe(1)
    expect(mockDbTables.conversations.put).toHaveBeenCalled()
  })

  it('should handle deleted record when local is not dirty', async () => {
    const record = makeSyncRecord({ id: 'c1', entityType: 'conversation', deleted: true })
    mockDbTables.conversations.get.mockResolvedValue({ id: 'c1', dirty: false })

    const result = await mergeRemoteChanges([record], true)
    expect(result.applied.conversations).toBe(1)
    expect(mockDbTables.conversations.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ deleted: true })
    )
  })

  it('should handle deleted record when local is dirty and autoResolve is off', async () => {
    const record = makeSyncRecord({ id: 'c1', entityType: 'conversation', deleted: true })
    mockDbTables.conversations.get.mockResolvedValue({ id: 'c1', dirty: true })

    const result = await mergeRemoteChanges([record], false)
    expect(result.applied.conversations).toBe(0)
    expect(result.conflicts).toHaveLength(1)
  })

  it('should count both conversations and messages in a mixed batch', async () => {
    const conv = makeSyncRecord({ id: 'c1', entityType: 'conversation' })
    const msg = makeSyncRecord({ id: 'm1', entityType: 'message', data: { id: 'm1' } })

    const result = await mergeRemoteChanges([conv, msg], true)
    expect(result.applied.conversations).toBe(1)
    expect(result.applied.messages).toBe(1)
  })

  it('should handle deletion of non-existent record gracefully', async () => {
    const record = makeSyncRecord({ id: 'c-gone', entityType: 'conversation', deleted: true })
    mockDbTables.conversations.get.mockResolvedValue(undefined)

    const result = await mergeRemoteChanges([record], true)
    // Should count as applied since there's nothing to conflict with
    expect(result.applied.conversations).toBe(1)
  })
})
