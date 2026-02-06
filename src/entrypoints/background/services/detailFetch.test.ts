import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Conversation } from '@/types'

const mockBrowser = vi.hoisted(() => ({
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
}))

const mockNotifyExtensionPages = vi.hoisted(() => vi.fn())
const mockGetConversationById = vi.hoisted(() => vi.fn())
const mockGetConversations = vi.hoisted(() => vi.fn())
const mockExportData = vi.hoisted(() => vi.fn())

vi.mock('wxt/browser', () => ({ browser: mockBrowser }))
vi.mock('@/utils/db', () => ({
  getConversationById: mockGetConversationById,
  getConversations: mockGetConversations,
}))
vi.mock('@/utils/sync/export', () => ({
  exportData: mockExportData,
}))
vi.mock('../handlers/utils', () => ({
  notifyExtensionPages: mockNotifyExtensionPages,
  sendMessageSafe: vi.fn(),
}))
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const { getClaudeOrgId, findClaudeTab, buildDetailApiUrl, batchFetchDetails, cancelBatchFetch } =
  await import('./detailFetch')

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'claude_abc',
    platform: 'claude',
    originalId: 'abc',
    title: 'Test',
    createdAt: 1000,
    updatedAt: 2000,
    messageCount: 1,
    preview: 'Hello',
    tags: [],
    syncedAt: 1000,
    detailStatus: 'none',
    detailSyncedAt: null,
    isFavorite: false,
    favoriteAt: null,
    ...overrides,
  }
}

function makeExportResult() {
  const blob = new Blob(['test'], { type: 'application/zip' })
  return {
    blob,
    filename: 'chatcentral_1conv_0msg_20260206.zip',
    stats: { conversations: 1, messages: 0, sizeBytes: blob.size },
  }
}

describe('detailFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getClaudeOrgId', () => {
    it('should return org_id from storage', async () => {
      mockBrowser.storage.local.get.mockResolvedValue({
        claude_org_id: 'org-123-abc',
      })
      const result = await getClaudeOrgId()
      expect(result).toBe('org-123-abc')
    })

    it('should return null when not stored', async () => {
      mockBrowser.storage.local.get.mockResolvedValue({})
      const result = await getClaudeOrgId()
      expect(result).toBeNull()
    })
  })

  describe('findClaudeTab', () => {
    it('should return null when no Claude tabs exist', async () => {
      mockBrowser.tabs.query.mockResolvedValue([])
      const result = await findClaudeTab()
      expect(result).toBeNull()
    })

    it('should prefer active tab', async () => {
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, active: false },
        { id: 2, active: true },
      ])
      const result = await findClaudeTab()
      expect(result).toBe(2)
    })

    it('should return first tab when none is active', async () => {
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 5, active: false },
        { id: 6, active: false },
      ])
      const result = await findClaudeTab()
      expect(result).toBe(5)
    })
  })

  describe('buildDetailApiUrl', () => {
    it('should build correct URL', () => {
      expect(buildDetailApiUrl('org-123', 'conv-456')).toBe(
        'https://claude.ai/api/organizations/org-123/chat_conversations/conv-456'
      )
    })
  })

  describe('batchFetchDetails', () => {
    it('should generate export when all conversations already have full details', async () => {
      mockGetConversations.mockResolvedValue([makeConversation({ detailStatus: 'full' })])
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('claude')

      expect(mockGetConversations).toHaveBeenCalledWith({ platform: 'claude' })
      expect(mockExportData).toHaveBeenCalledWith({ type: 'full', platforms: ['claude'] })
      expect(mockNotifyExtensionPages).toHaveBeenCalledWith(
        'BATCH_FETCH_PROGRESS',
        expect.objectContaining({
          status: 'done',
          completed: 0,
          total: 0,
          base64: expect.any(String),
          filename: expect.any(String),
        })
      )
    })

    it('should generate export with base64 after fetching details', async () => {
      const conv = makeConversation({ id: 'claude_1', originalId: '1', detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.storage.local.get.mockResolvedValue({ claude_org_id: 'org-123' })
      mockBrowser.tabs.query.mockResolvedValue([{ id: 10, active: true }])
      mockBrowser.tabs.sendMessage.mockResolvedValue(undefined)
      // Polling: return full on second call
      let callCount = 0
      mockGetConversationById.mockImplementation(async () => {
        callCount++
        if (callCount > 0) {
          return makeConversation({ id: 'claude_1', detailStatus: 'full' })
        }
        return conv
      })
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('claude')

      expect(mockExportData).toHaveBeenCalledWith({ type: 'full', platforms: ['claude'] })
      const calls = mockNotifyExtensionPages.mock.calls
      const doneCall = calls.find(
        (c: unknown[]) => (c[1] as Record<string, unknown>)?.status === 'done'
      )
      expect(doneCall).toBeDefined()
      expect((doneCall![1] as Record<string, unknown>).base64).toBeDefined()
      expect((doneCall![1] as Record<string, unknown>).filename).toBeDefined()
    })

    it('should error when org_id is missing', async () => {
      mockGetConversations.mockResolvedValue([makeConversation({ detailStatus: 'none' })])
      mockBrowser.storage.local.get.mockResolvedValue({})

      await batchFetchDetails('claude')

      expect(mockNotifyExtensionPages).toHaveBeenCalledWith(
        'BATCH_FETCH_PROGRESS',
        expect.objectContaining({
          status: 'error',
          error: expect.stringContaining('org_id'),
        })
      )
    })

    it('should error when no Claude tab is open', async () => {
      mockGetConversations.mockResolvedValue([makeConversation({ detailStatus: 'none' })])
      mockBrowser.storage.local.get.mockResolvedValue({ claude_org_id: 'org-123' })
      mockBrowser.tabs.query.mockResolvedValue([])

      await batchFetchDetails('claude')

      expect(mockNotifyExtensionPages).toHaveBeenCalledWith(
        'BATCH_FETCH_PROGRESS',
        expect.objectContaining({
          status: 'error',
          error: expect.stringContaining('No Claude tab'),
        })
      )
    })

    it('should stop on cancel', async () => {
      const conv1 = makeConversation({ id: 'claude_1', originalId: '1', detailStatus: 'none' })
      const conv2 = makeConversation({ id: 'claude_2', originalId: '2', detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv1, conv2])
      let callCount = 0
      mockGetConversationById.mockImplementation(async (id: string) => {
        if (id === 'claude_1') {
          callCount++
          // First call is polling — return full
          if (callCount > 0) {
            return makeConversation({ id: 'claude_1', detailStatus: 'full' })
          }
          return conv1
        }
        return conv2
      })
      mockBrowser.storage.local.get.mockResolvedValue({ claude_org_id: 'org-123' })
      mockBrowser.tabs.query.mockResolvedValue([{ id: 10, active: true }])
      mockBrowser.tabs.sendMessage.mockImplementation(async () => {
        // Cancel after first send
        cancelBatchFetch()
      })

      await batchFetchDetails('claude')

      // Should have sent a cancelled status
      const calls = mockNotifyExtensionPages.mock.calls
      const cancelledCall = calls.find(
        (c: unknown[]) => (c[1] as Record<string, unknown>)?.status === 'cancelled'
      )
      expect(cancelledCall).toBeDefined()
    })

    it('should generate export even when no conversations exist', async () => {
      mockGetConversations.mockResolvedValue([])
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('claude')

      expect(mockExportData).toHaveBeenCalledWith({ type: 'full', platforms: ['claude'] })
      expect(mockNotifyExtensionPages).toHaveBeenCalledWith(
        'BATCH_FETCH_PROGRESS',
        expect.objectContaining({ status: 'done', base64: expect.any(String) })
      )
    })

    // ── limit parameter tests ──

    it('should pass limit and orderBy to getConversations when limit is provided', async () => {
      mockGetConversations.mockResolvedValue([
        makeConversation({ id: 'claude_1', detailStatus: 'full' }),
        makeConversation({ id: 'claude_2', detailStatus: 'full' }),
      ])
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('claude', 20)

      expect(mockGetConversations).toHaveBeenCalledWith({
        platform: 'claude',
        limit: 20,
        orderBy: 'updatedAt',
      })
    })

    it('should use selective export (type: selected) when limit is provided', async () => {
      const conv1 = makeConversation({ id: 'claude_1', detailStatus: 'full' })
      const conv2 = makeConversation({ id: 'claude_2', detailStatus: 'full' })
      mockGetConversations.mockResolvedValue([conv1, conv2])
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('claude', 10)

      expect(mockExportData).toHaveBeenCalledWith({
        type: 'selected',
        conversationIds: ['claude_1', 'claude_2'],
      })
    })

    it('should use full export (type: full) when no limit is provided', async () => {
      mockGetConversations.mockResolvedValue([makeConversation({ detailStatus: 'full' })])
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('claude')

      expect(mockExportData).toHaveBeenCalledWith({ type: 'full', platforms: ['claude'] })
    })

    it('should use selective export after fetching details with limit', async () => {
      const conv = makeConversation({ id: 'claude_1', originalId: '1', detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.storage.local.get.mockResolvedValue({ claude_org_id: 'org-123' })
      mockBrowser.tabs.query.mockResolvedValue([{ id: 10, active: true }])
      mockBrowser.tabs.sendMessage.mockResolvedValue(undefined)
      mockGetConversationById.mockResolvedValue(
        makeConversation({ id: 'claude_1', detailStatus: 'full' })
      )
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('claude', 5)

      expect(mockExportData).toHaveBeenCalledWith({
        type: 'selected',
        conversationIds: ['claude_1'],
      })
    })
  })
})
