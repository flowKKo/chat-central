import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRestProvider, type RestProviderConfig, RestSyncProvider } from './rest'
import type { SyncRecord } from '../types'

describe('restSyncProvider', () => {
  let provider: RestSyncProvider

  beforeEach(() => {
    provider = createRestProvider()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createRestProvider', () => {
    it('should create a new RestSyncProvider instance', () => {
      const instance = createRestProvider()
      expect(instance).toBeInstanceOf(RestSyncProvider)
      expect(instance.name).toBe('REST API')
      expect(instance.type).toBe('rest')
    })
  })

  describe('connect', () => {
    it('should throw error for non-rest config type', async () => {
      // eslint-disable-next-line ts/no-explicit-any
      const config = { type: 'google-drive' } as any
      await expect(provider.connect(config)).rejects.toThrow(
        'Invalid config type for REST provider'
      )
    })

    it('should throw error for missing endpoint', async () => {
      const config: RestProviderConfig = { type: 'rest', endpoint: '' }
      await expect(provider.connect(config)).rejects.toThrow(
        'Endpoint is required for REST provider'
      )
    })

    it('should connect successfully when health endpoint returns OK', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      )

      const config: RestProviderConfig = {
        type: 'rest',
        endpoint: 'https://api.example.com',
      }

      await provider.connect(config)
      expect(provider.isConnected()).toBe(true)
    })

    it('should throw error when health endpoint fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Server Error', { status: 500 })
      )

      const config: RestProviderConfig = {
        type: 'rest',
        endpoint: 'https://api.example.com',
      }

      await expect(provider.connect(config)).rejects.toThrow('Failed to connect to sync server')
      expect(provider.isConnected()).toBe(false)
    })

    it('should throw error on network failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      const config: RestProviderConfig = {
        type: 'rest',
        endpoint: 'https://api.example.com',
      }

      await expect(provider.connect(config)).rejects.toThrow(
        'Failed to connect to sync server: Network error'
      )
    })

    it('should use default timeout if not specified', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))

      const config: RestProviderConfig = {
        type: 'rest',
        endpoint: 'https://api.example.com',
      }

      await provider.connect(config)
      expect(provider.isConnected()).toBe(true)
    })

    it('should include API key in authorization header', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))

      const config: RestProviderConfig = {
        type: 'rest',
        endpoint: 'https://api.example.com',
        apiKey: 'secret-key',
      }

      await provider.connect(config)

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect((options.headers as Record<string, string>).Authorization).toBe('Bearer secret-key')
    })
  })

  describe('disconnect', () => {
    it('should disconnect and clear state', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))

      await provider.connect({
        type: 'rest',
        endpoint: 'https://api.example.com',
      })
      expect(provider.isConnected()).toBe(true)

      await provider.disconnect()
      expect(provider.isConnected()).toBe(false)
    })

    it('should handle disconnect when not connected', async () => {
      await expect(provider.disconnect()).resolves.not.toThrow()
    })
  })

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(provider.isConnected()).toBe(false)
    })

    it('should return true after successful connect', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))

      await provider.connect({
        type: 'rest',
        endpoint: 'https://api.example.com',
      })

      expect(provider.isConnected()).toBe(true)
    })
  })

  describe('pull', () => {
    beforeEach(async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))
      await provider.connect({
        type: 'rest',
        endpoint: 'https://api.example.com',
      })
    })

    it('should return auth_failed error when not connected', async () => {
      await provider.disconnect()

      const result = await provider.pull()
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('auth_failed')
    })

    it('should pull records successfully', async () => {
      const mockRecords: SyncRecord[] = [
        {
          id: 'conv-1',
          entityType: 'conversation',
          data: { id: 'conv-1', title: 'Test' },
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ]

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            records: mockRecords,
            cursor: 'next-cursor',
            hasMore: true,
          }),
          { status: 200 }
        )
      )

      const result = await provider.pull()
      expect(result.success).toBe(true)
      expect(result.records).toEqual(mockRecords)
      expect(result.cursor).toBe('next-cursor')
      expect(result.hasMore).toBe(true)
    })

    it('should include cursor in request', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            records: [],
            cursor: null,
            hasMore: false,
          }),
          { status: 200 }
        )
      )

      await provider.pull('my-cursor')

      const [url] = fetchSpy.mock.calls[0] as [string, unknown]
      expect(url).toContain('cursor=my-cursor')
    })

    it('should handle network error during pull', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failed'))

      const result = await provider.pull()
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('network_error')
      expect(result.error?.message).toContain('Network failed')
    })

    it('should handle 401 response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      )

      const result = await provider.pull()
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('auth_failed')
    })

    it('should handle 429 rate limit response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
      )

      const result = await provider.pull()
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('quota_exceeded')
      expect(result.error?.retryAfter).toBe(60000)
    })
  })

  describe('push', () => {
    beforeEach(async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))
      await provider.connect({
        type: 'rest',
        endpoint: 'https://api.example.com',
      })
    })

    it('should return auth_failed error when not connected', async () => {
      await provider.disconnect()

      const result = await provider.push([])
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('auth_failed')
    })

    it('should return success for empty changes', async () => {
      const result = await provider.push([])
      expect(result.success).toBe(true)
      expect(result.applied).toEqual([])
      expect(result.failed).toEqual([])
    })

    it('should push records successfully', async () => {
      const changes: SyncRecord[] = [
        {
          id: 'conv-1',
          entityType: 'conversation',
          data: { id: 'conv-1', title: 'Test' },
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ]

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            applied: ['conv-1'],
            failed: [],
          }),
          { status: 200 }
        )
      )

      const result = await provider.push(changes)
      expect(result.success).toBe(true)
      expect(result.applied).toEqual(['conv-1'])
    })

    it('should handle partial failures', async () => {
      const changes: SyncRecord[] = [
        {
          id: 'conv-1',
          entityType: 'conversation',
          data: {},
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
        {
          id: 'conv-2',
          entityType: 'conversation',
          data: {},
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ]

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            applied: ['conv-1'],
            failed: [{ id: 'conv-2', reason: 'conflict', message: 'Version conflict' }],
          }),
          { status: 200 }
        )
      )

      const result = await provider.push(changes)
      expect(result.success).toBe(true)
      expect(result.applied).toEqual(['conv-1'])
      expect(result.failed).toHaveLength(1)
      expect(result.failed?.[0]?.id).toBe('conv-2')
    })

    it('should handle 409 conflict response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Conflict detected' }), { status: 409 })
      )

      const result = await provider.push([
        {
          id: 'conv-1',
          entityType: 'conversation',
          data: {},
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ])
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('conflict')
    })

    it('should handle network error during push', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection reset'))

      const result = await provider.push([
        {
          id: 'conv-1',
          entityType: 'conversation',
          data: {},
          syncVersion: 1,
          modifiedAt: Date.now(),
          deleted: false,
        },
      ])
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('network_error')
    })
  })
})
