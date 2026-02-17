import { describe, it, expect, vi } from 'vitest'
import { pullChanges } from './pull'
import type { PullResult, SyncProvider, SyncRecord } from '../types'

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
      cursor: null,
      hasMore: false,
    }),
    push: vi.fn().mockResolvedValue({ success: true, applied: [], failed: [] }),
    ...overrides,
  }
}

function makeSyncRecord(id: string): SyncRecord {
  return {
    id,
    entityType: 'conversation',
    data: { id, title: `Record ${id}` },
    syncVersion: 1,
    modifiedAt: Date.now(),
    deleted: false,
  }
}

describe('pullChanges', () => {
  it('should return empty records when provider returns none', async () => {
    const provider = createMockProvider()
    const result = await pullChanges(provider, null)
    expect(result.success).toBe(true)
    expect(result.records).toEqual([])
    expect(result.hasMore).toBe(false)
  })

  it('should pass cursor to provider.pull', async () => {
    const provider = createMockProvider()
    await pullChanges(provider, 'my-cursor')
    expect(provider.pull).toHaveBeenCalledWith('my-cursor')
  })

  it('should pass null cursor on first pull', async () => {
    const provider = createMockProvider()
    await pullChanges(provider, null)
    expect(provider.pull).toHaveBeenCalledWith(null)
  })

  it('should return all records from a single page', async () => {
    const records = [makeSyncRecord('r1'), makeSyncRecord('r2')]
    const provider = createMockProvider({
      pull: vi.fn().mockResolvedValue({
        success: true,
        records,
        cursor: 'end',
        hasMore: false,
      }),
    })

    const result = await pullChanges(provider, null)
    expect(result.success).toBe(true)
    expect(result.records).toHaveLength(2)
    expect(result.cursor).toBe('end')
  })

  it('should paginate through multiple pages', async () => {
    const pullFn = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        records: [makeSyncRecord('r1')],
        cursor: 'page2',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        success: true,
        records: [makeSyncRecord('r2')],
        cursor: 'page3',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        success: true,
        records: [makeSyncRecord('r3')],
        cursor: 'done',
        hasMore: false,
      })

    const provider = createMockProvider({ pull: pullFn })
    const result = await pullChanges(provider, null)

    expect(pullFn).toHaveBeenCalledTimes(3)
    expect(pullFn).toHaveBeenNthCalledWith(1, null)
    expect(pullFn).toHaveBeenNthCalledWith(2, 'page2')
    expect(pullFn).toHaveBeenNthCalledWith(3, 'page3')
    expect(result.records).toHaveLength(3)
    expect(result.records.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
    expect(result.cursor).toBe('done')
    expect(result.hasMore).toBe(false)
  })

  it('should return error immediately when first page fails', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockResolvedValue({
        success: false,
        records: [],
        cursor: null,
        hasMore: false,
        error: { code: 'network_error', message: 'Timeout', recoverable: true },
      }),
    })

    const result = await pullChanges(provider, null)
    expect(result.success).toBe(false)
    expect(result.records).toEqual([])
    expect(result.error?.code).toBe('network_error')
  })

  it('should return error when a subsequent page fails', async () => {
    const pullFn = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        records: [makeSyncRecord('r1')],
        cursor: 'page2',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        success: false,
        records: [],
        cursor: null,
        hasMore: false,
        error: { code: 'auth_failed', message: 'Token expired', recoverable: false },
      })

    const provider = createMockProvider({ pull: pullFn })
    const result = await pullChanges(provider, 'start')

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('auth_failed')
  })

  it('should handle provider returning empty page with no more data', async () => {
    const provider = createMockProvider({
      pull: vi.fn().mockResolvedValue({
        success: true,
        records: [],
        cursor: null,
        hasMore: false,
      }),
    })

    const result = await pullChanges(provider, 'some-cursor')
    expect(result.success).toBe(true)
    expect(result.records).toEqual([])
    expect(result.cursor).toBeNull()
  })
})
