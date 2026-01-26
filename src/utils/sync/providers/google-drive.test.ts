import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleDriveProvider } from './google-drive'

// Mock chrome.identity and chrome.runtime APIs
const mockChrome = {
  identity: {
    getAuthToken: vi.fn(),
    removeCachedAuthToken: vi.fn(),
  },
  runtime: {
    lastError: undefined as { message: string } | undefined,
  },
}

// @ts-expect-error - mocking global chrome
globalThis.chrome = mockChrome

// Mock fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('googleDriveProvider', () => {
  let provider: GoogleDriveProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new GoogleDriveProvider()
    mockChrome.runtime.lastError = undefined
  })

  afterEach(async () => {
    if (provider.isConnected()) {
      // Mock successful disconnect
      mockFetch.mockResolvedValueOnce({ ok: true })
      mockChrome.identity.removeCachedAuthToken.mockImplementation((_, callback) => callback())
      await provider.disconnect()
    }
  })

  describe('connect', () => {
    it('should connect successfully with valid token', async () => {
      mockChrome.identity.getAuthToken.mockImplementation((_, callback) => {
        callback('test-token-123')
      })

      await provider.connect()

      expect(provider.isConnected()).toBe(true)
      expect(mockChrome.identity.getAuthToken).toHaveBeenCalledWith(
        { interactive: true },
        expect.any(Function),
      )
    })

    it('should throw error when chrome.identity is not available', async () => {
      const originalIdentity = mockChrome.identity
      // @ts-expect-error - testing missing identity API
      mockChrome.identity = undefined

      await expect(provider.connect()).rejects.toThrow('Chrome identity API not available')

      mockChrome.identity = originalIdentity
    })

    it('should throw error when token is not received', async () => {
      mockChrome.identity.getAuthToken.mockImplementation((_, callback) => {
        callback(undefined)
      })

      await expect(provider.connect()).rejects.toThrow('No token received')
    })

    it('should throw error when chrome.runtime.lastError is set', async () => {
      mockChrome.identity.getAuthToken.mockImplementation((_, callback) => {
        mockChrome.runtime.lastError = { message: 'User cancelled' }
        callback(undefined)
      })

      await expect(provider.connect()).rejects.toThrow('User cancelled')

      mockChrome.runtime.lastError = undefined
    })
  })

  describe('disconnect', () => {
    beforeEach(async () => {
      // Connect first
      mockChrome.identity.getAuthToken.mockImplementation((_, callback) => {
        callback('test-token-123')
      })
      await provider.connect()
    })

    it('should disconnect and clear state', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true }) // revoke token
      mockChrome.identity.removeCachedAuthToken.mockImplementation((_, callback) => callback())

      await provider.disconnect()

      expect(provider.isConnected()).toBe(false)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('accounts.google.com/o/oauth2/revoke'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('should handle revoke token failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      mockChrome.identity.removeCachedAuthToken.mockImplementation((_, callback) => callback())

      // Should not throw
      await expect(provider.disconnect()).resolves.not.toThrow()
      expect(provider.isConnected()).toBe(false)
    })
  })

  describe('upload', () => {
    beforeEach(async () => {
      mockChrome.identity.getAuthToken.mockImplementation((_, callback) => {
        callback('test-token-123')
      })
      await provider.connect()
    })

    it('should create new file when file does not exist', async () => {
      // Mock token validation (ensureToken #1 in upload)
      mockFetch.mockResolvedValueOnce({ ok: true })
      // Mock token validation (ensureToken #2 in findFile)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Mock file search - no files found
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      })

      // Mock file creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-file-id' }),
      })

      await provider.upload('{"test": true}', 'test-file.json')

      expect(mockFetch).toHaveBeenCalledTimes(4)
      // Last call should be POST to create file
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('upload/drive/v3/files'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('should update existing file', async () => {
      // Mock token validation (ensureToken #1 in upload)
      mockFetch.mockResolvedValueOnce({ ok: true })
      // Mock token validation (ensureToken #2 in findFile)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Mock file search - file found
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [{ id: 'existing-file-id', name: 'test-file.json' }],
          }),
      })

      // Mock file update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'existing-file-id' }),
      })

      await provider.upload('{"test": true}', 'test-file.json')

      expect(mockFetch).toHaveBeenCalledTimes(4)
      // Last call should be PATCH to update file
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('existing-file-id'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('should throw error on upload failure', async () => {
      // Mock token validation (ensureToken #1 in upload)
      mockFetch.mockResolvedValueOnce({ ok: true })
      // Mock token validation (ensureToken #2 in findFile)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Mock file search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      })

      // Mock file creation failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      })

      await expect(provider.upload('{"test": true}', 'test-file.json')).rejects.toThrow(
        'Failed to create file',
      )
    })
  })

  describe('download', () => {
    beforeEach(async () => {
      mockChrome.identity.getAuthToken.mockImplementation((_, callback) => {
        callback('test-token-123')
      })
      await provider.connect()
    })

    it('should return null when file does not exist', async () => {
      // Mock token validation (ensureToken in download)
      mockFetch.mockResolvedValueOnce({ ok: true })
      // Mock token validation (ensureToken in findFile)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Mock file search - no files
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await provider.download('test-file.json')

      expect(result).toBeNull()
    })

    it('should download file content', async () => {
      // Mock token validation (ensureToken in download)
      mockFetch.mockResolvedValueOnce({ ok: true })
      // Mock token validation (ensureToken in findFile)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Mock file search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [{ id: 'file-id', name: 'test-file.json' }],
          }),
      })

      // Mock file download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"downloaded": true}'),
      })

      const result = await provider.download('test-file.json')

      expect(result).toBe('{"downloaded": true}')
    })

    it('should throw error on download failure', async () => {
      // Mock token validation (ensureToken in download)
      mockFetch.mockResolvedValueOnce({ ok: true })
      // Mock token validation (ensureToken in findFile)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Mock file search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [{ id: 'file-id', name: 'test-file.json' }],
          }),
      })

      // Mock file download failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(provider.download('test-file.json')).rejects.toThrow('Failed to download file')
    })
  })

  describe('getLastModified', () => {
    beforeEach(async () => {
      mockChrome.identity.getAuthToken.mockImplementation((_, callback) => {
        callback('test-token-123')
      })
      await provider.connect()
    })

    it('should return null when file does not exist', async () => {
      // Mock token validation (ensureToken in getLastModified)
      mockFetch.mockResolvedValueOnce({ ok: true })
      // Mock token validation (ensureToken in findFile)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Mock file search - no files
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await provider.getLastModified('test-file.json')

      expect(result).toBeNull()
    })

    it('should return modification timestamp', async () => {
      const modifiedTime = '2024-01-15T10:30:00.000Z'

      // Mock token validation (ensureToken in getLastModified)
      mockFetch.mockResolvedValueOnce({ ok: true })
      // Mock token validation (ensureToken in findFile)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Mock file search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [{ id: 'file-id', name: 'test-file.json' }],
          }),
      })

      // Mock metadata fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ modifiedTime }),
      })

      const result = await provider.getLastModified('test-file.json')

      expect(result).toBe(new Date(modifiedTime).getTime())
    })
  })

  describe('token refresh', () => {
    it('should refresh token when validation fails', async () => {
      let callCount = 0
      mockChrome.identity.getAuthToken.mockImplementation((_options, callback) => {
        callCount++
        if (callCount === 1) {
          // First connect
          callback('old-token')
        }
        else if (callCount === 2) {
          // Non-interactive refresh attempt fails
          mockChrome.runtime.lastError = { message: 'Token expired' }
          callback(undefined)
          mockChrome.runtime.lastError = undefined
        }
        else {
          // Interactive refresh succeeds
          callback('new-token')
        }
      })

      await provider.connect()

      // Mock token validation failure (triggers refresh)
      // ensureToken #1 in upload: validateToken('old-token') fails
      mockFetch.mockResolvedValueOnce({ ok: false })

      // ensureToken #2 in findFile: validateToken('new-token') succeeds
      mockFetch.mockResolvedValueOnce({ ok: true })

      // File search in findFile (needs json method)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      })

      // File creation (needs json method)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-file-id' }),
      })

      await provider.upload('test', 'test.json')

      // Should have called getAuthToken multiple times for refresh
      // 1. Initial connect, 2. Non-interactive refresh (fails), 3. Interactive refresh (succeeds)
      expect(mockChrome.identity.getAuthToken).toHaveBeenCalledTimes(3)
    })
  })

  describe('provider properties', () => {
    it('should have correct name and type', () => {
      expect(provider.name).toBe('Google Drive')
      expect(provider.type).toBe('google-drive')
    })
  })
})
