import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyConflictResolution, handlePushConflict } from './resolve'
import type { ConflictRecord, SyncRecord } from '../types'

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

const baseConflict: ConflictRecord = {
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

describe('applyConflictResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbTables.conversations.put.mockResolvedValue(undefined)
    mockDbTables.messages.put.mockResolvedValue(undefined)
    mockDbTables.conflicts.get.mockResolvedValue(undefined)
    mockDbTables.conflicts.update.mockResolvedValue(undefined)
  })

  it('should throw when conflict not found', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(undefined)
    await expect(applyConflictResolution('missing', 'local')).rejects.toThrow('Conflict not found')
  })

  it('should apply local version for conversation', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(baseConflict)
    await applyConflictResolution('conflict-1', 'local')

    expect(mockDbTables.conversations.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', title: 'Local Title', dirty: true })
    )
  })

  it('should apply remote version for conversation', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(baseConflict)
    await applyConflictResolution('conflict-1', 'remote')

    expect(mockDbTables.conversations.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', title: 'Remote Title', dirty: false })
    )
  })

  it('should apply merged data when provided', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(baseConflict)
    const merged = { id: 'c1', title: 'Merged Title' }
    await applyConflictResolution('conflict-1', 'merged', merged)

    expect(mockDbTables.conversations.put).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Merged Title' })
    )
  })

  it('should throw when merged resolution has no data', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(baseConflict)
    await expect(applyConflictResolution('conflict-1', 'merged')).rejects.toThrow(
      'No data to apply'
    )
  })

  it('should resolve message entity type with local', async () => {
    const msgConflict: ConflictRecord = {
      ...baseConflict,
      entityType: 'message',
      entityId: 'm1',
      localVersion: { id: 'm1', content: 'Local' },
      remoteVersion: { id: 'm1', content: 'Remote' },
    }
    mockDbTables.conflicts.get.mockResolvedValue(msgConflict)

    await applyConflictResolution('conflict-1', 'local')

    expect(mockDbTables.messages.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1', content: 'Local', dirty: true })
    )
    expect(mockDbTables.conversations.put).not.toHaveBeenCalled()
  })

  it('should resolve message entity type with remote', async () => {
    const msgConflict: ConflictRecord = {
      ...baseConflict,
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
    mockDbTables.conflicts.get.mockResolvedValue(baseConflict)
    await applyConflictResolution('conflict-1', 'local')

    expect(mockDbTables.conflicts.update).toHaveBeenCalledWith('conflict-1', {
      resolution: 'local',
      resolvedAt: expect.any(Number),
    })
  })

  it('should mark conflict resolved as remote', async () => {
    mockDbTables.conflicts.get.mockResolvedValue(baseConflict)
    await applyConflictResolution('conflict-1', 'remote')

    expect(mockDbTables.conflicts.update).toHaveBeenCalledWith('conflict-1', {
      resolution: 'remote',
      resolvedAt: expect.any(Number),
    })
  })
})

describe('handlePushConflict', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbTables.conversations.get.mockResolvedValue(undefined)
    mockDbTables.conversations.add.mockResolvedValue(undefined)
    mockDbTables.conversations.put.mockResolvedValue(undefined)
    mockDbTables.messages.get.mockResolvedValue(undefined)
    mockDbTables.messages.add.mockResolvedValue(undefined)
    mockDbTables.messages.put.mockResolvedValue(undefined)
  })

  it('should handle conversation push conflict by re-merging', async () => {
    const serverVersion: SyncRecord = {
      id: 'c1',
      entityType: 'conversation',
      data: { id: 'c1', title: 'Server' },
      syncVersion: 3,
      modifiedAt: Date.now(),
      deleted: false,
    }

    const result = await handlePushConflict(serverVersion, true)
    // With autoResolve and no local record, should add and return no conflict
    expect(result).toBeNull()
  })

  it('should handle message push conflict by re-merging', async () => {
    const serverVersion: SyncRecord = {
      id: 'm1',
      entityType: 'message',
      data: { id: 'm1', content: 'Server msg' },
      syncVersion: 2,
      modifiedAt: Date.now(),
      deleted: false,
    }

    const result = await handlePushConflict(serverVersion, true)
    expect(result).toBeNull()
  })

  it('should return conflict when local is dirty and autoResolve is off', async () => {
    mockDbTables.conversations.get.mockResolvedValue({
      id: 'c1',
      title: 'Local',
      dirty: true,
    })

    const serverVersion: SyncRecord = {
      id: 'c1',
      entityType: 'conversation',
      data: { id: 'c1', title: 'Server' },
      syncVersion: 3,
      modifiedAt: Date.now(),
      deleted: true,
    }

    const result = await handlePushConflict(serverVersion, false)
    expect(result).not.toBeNull()
    expect(result!.entityId).toBe('c1')
    expect(result!.resolution).toBe('pending')
  })
})
