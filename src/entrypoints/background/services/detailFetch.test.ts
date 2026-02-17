import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Conversation, Platform } from '@/types'

const mockOnUpdatedListeners: Array<(tabId: number, changeInfo: { status?: string }) => void> = []

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
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    onUpdated: {
      addListener: vi.fn((fn: (tabId: number, changeInfo: { status?: string }) => void) => {
        mockOnUpdatedListeners.push(fn)
      }),
      removeListener: vi.fn((fn: (tabId: number, changeInfo: { status?: string }) => void) => {
        const idx = mockOnUpdatedListeners.indexOf(fn)
        if (idx >= 0) mockOnUpdatedListeners.splice(idx, 1)
      }),
    },
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

const {
  getClaudeOrgId,
  findPlatformTab,
  getStrategy,
  waitForTabLoad,
  batchFetchDetails,
  cancelBatchFetch,
} = await import('./detailFetch')

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

/** Simulate tab completing load via onUpdated listener */
function simulateTabLoad(tabId: number) {
  for (const listener of [...mockOnUpdatedListeners]) {
    listener(tabId, { status: 'complete' })
  }
}

/** Set up mocks for a successful fetch-mode batch (Claude or ChatGPT) */
function setupFetchModeMocks(platform: Platform, tabId: number) {
  mockBrowser.tabs.query.mockImplementation(async (query: { url: string }) => {
    const strategy = getStrategy(platform)
    if (strategy.tabPatterns.includes(query.url)) {
      return [{ id: tabId, active: true }]
    }
    return []
  })
  mockBrowser.tabs.sendMessage.mockResolvedValue(undefined)
}

/** Set up mocks for navigate-mode tab creation (simulates tab load) */
function setupNavigateTabCreate(tabId: number) {
  mockBrowser.tabs.create.mockImplementation(async () => {
    // Simulate tab load shortly after creation
    setTimeout(() => simulateTabLoad(tabId), 5)
    return { id: tabId }
  })
  mockBrowser.tabs.update.mockImplementation(async () => {
    // Simulate tab load shortly after navigation
    setTimeout(() => simulateTabLoad(tabId), 5)
    return {}
  })
  mockBrowser.tabs.remove.mockResolvedValue(undefined)
}

describe('detailFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnUpdatedListeners.length = 0
  })

  // ── Helpers ──

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

  describe('findPlatformTab', () => {
    it('should find tab across multiple patterns', async () => {
      mockBrowser.tabs.query.mockImplementation(async (query: { url: string }) => {
        if (query.url === 'https://chatgpt.com/*') return []
        if (query.url === 'https://chat.openai.com/*') return [{ id: 7, active: true }]
        return []
      })

      const result = await findPlatformTab(['https://chatgpt.com/*', 'https://chat.openai.com/*'])
      expect(result).toBe(7)
    })

    it('should prefer active tab', async () => {
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, active: false },
        { id: 2, active: true },
      ])
      const result = await findPlatformTab(['https://claude.ai/*'])
      expect(result).toBe(2)
    })

    it('should return first tab when none is active', async () => {
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 5, active: false },
        { id: 6, active: false },
      ])
      const result = await findPlatformTab(['https://claude.ai/*'])
      expect(result).toBe(5)
    })

    it('should return null when no tabs match any pattern', async () => {
      mockBrowser.tabs.query.mockResolvedValue([])
      const result = await findPlatformTab(['https://example.com/*'])
      expect(result).toBeNull()
    })
  })

  describe('waitForTabLoad', () => {
    it('should resolve when tab status becomes complete', async () => {
      const promise = waitForTabLoad(42, 5000)
      // Listener should be registered
      expect(mockBrowser.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1)

      // Simulate tab load
      simulateTabLoad(42)

      await promise
      // Listener should be cleaned up
      expect(mockBrowser.tabs.onUpdated.removeListener).toHaveBeenCalledTimes(1)
    })

    it('should not resolve for wrong tab id', async () => {
      let resolved = false
      const promise = waitForTabLoad(42, 50).then(() => {
        resolved = true
      })

      // Simulate wrong tab
      simulateTabLoad(99)

      // Should only resolve from timeout, not from the wrong tab event
      await promise
      expect(resolved).toBe(true)
    })

    it('should resolve on timeout if tab never completes', async () => {
      const start = Date.now()
      await waitForTabLoad(42, 50)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(45)
    })
  })

  // ── Platform Strategies ──

  describe('getStrategy', () => {
    it('should return claude strategy with fetch mode and init', () => {
      const s = getStrategy('claude')
      expect(s.mode).toBe('fetch')
      expect(s.tabPatterns).toContain('https://claude.ai/*')
      expect(s.init).toBeDefined()
    })

    it('should return chatgpt strategy with fetch mode and no init', () => {
      const s = getStrategy('chatgpt')
      expect(s.mode).toBe('fetch')
      expect(s.tabPatterns).toContain('https://chatgpt.com/*')
      expect(s.tabPatterns).toContain('https://chat.openai.com/*')
      expect(s.init).toBeUndefined()
    })

    it('should return gemini strategy with navigate mode and no init', () => {
      const s = getStrategy('gemini')
      expect(s.mode).toBe('navigate')
      expect(s.tabPatterns).toContain('https://gemini.google.com/*')
      expect(s.pollTimeoutMs).toBe(20_000)
      expect(s.fetchIntervalMs).toBe(3_000)
      expect(s.init).toBeUndefined()
    })

    it('should build correct chatgpt detail URL', () => {
      const s = getStrategy('chatgpt')
      expect(s.buildDetailUrl('conv-789')).toBe(
        'https://chatgpt.com/backend-api/conversation/conv-789'
      )
    })

    it('should build correct gemini detail URL', () => {
      const s = getStrategy('gemini')
      expect(s.buildDetailUrl('abc123')).toBe('https://gemini.google.com/app/abc123')
    })

    it('claude init should cache org_id and buildDetailUrl should use it', async () => {
      mockBrowser.storage.local.get.mockResolvedValue({ claude_org_id: 'org-xyz' })
      const s = getStrategy('claude')
      const err = await s.init!()
      expect(err).toBeNull()

      // buildDetailUrl is now sync and uses cached value
      const url = s.buildDetailUrl('conv-1')
      expect(url).toBe('https://claude.ai/api/organizations/org-xyz/chat_conversations/conv-1')
      // storage.local.get should only have been called once (during init)
      expect(mockBrowser.storage.local.get).toHaveBeenCalledTimes(1)
    })

    it('claude init should return error when org_id missing', async () => {
      mockBrowser.storage.local.get.mockResolvedValue({})
      const s = getStrategy('claude')
      const err = await s.init!()
      expect(err).toContain('org_id')
    })
  })

  // ── batchFetchDetails: Claude ──

  describe('batchFetchDetails - claude', () => {
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

    it('should call init once and reuse cached orgId for multiple fetches', async () => {
      const conv1 = makeConversation({ id: 'claude_1', originalId: '1', detailStatus: 'none' })
      const conv2 = makeConversation({ id: 'claude_2', originalId: '2', detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv1, conv2])
      mockBrowser.storage.local.get.mockResolvedValue({ claude_org_id: 'org-123' })
      mockBrowser.tabs.query.mockResolvedValue([{ id: 10, active: true }])
      mockBrowser.tabs.sendMessage.mockResolvedValue(undefined)
      mockGetConversationById.mockResolvedValue(makeConversation({ detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('claude')

      // storage.local.get called only once during init, not once per conversation
      expect(mockBrowser.storage.local.get).toHaveBeenCalledTimes(1)
      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledTimes(2)
    })

    it('should generate export with base64 after fetching details', async () => {
      const conv = makeConversation({ id: 'claude_1', originalId: '1', detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.storage.local.get.mockResolvedValue({ claude_org_id: 'org-123' })
      mockBrowser.tabs.query.mockResolvedValue([{ id: 10, active: true }])
      mockBrowser.tabs.sendMessage.mockResolvedValue(undefined)
      mockGetConversationById.mockResolvedValue(
        makeConversation({ id: 'claude_1', detailStatus: 'full' })
      )
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
      mockGetConversationById.mockImplementation(async (id: string) => {
        if (id === 'claude_1') {
          return makeConversation({ id: 'claude_1', detailStatus: 'full' })
        }
        return conv2
      })
      mockBrowser.storage.local.get.mockResolvedValue({ claude_org_id: 'org-123' })
      mockBrowser.tabs.query.mockResolvedValue([{ id: 10, active: true }])
      mockBrowser.tabs.sendMessage.mockImplementation(async () => {
        cancelBatchFetch()
      })

      await batchFetchDetails('claude')

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

  // ── batchFetchDetails: ChatGPT ──

  describe('batchFetchDetails - chatgpt', () => {
    const chatgptConv = (id: string, overrides: Partial<Conversation> = {}) =>
      makeConversation({
        id: `chatgpt_${id}`,
        originalId: id,
        platform: 'chatgpt',
        ...overrides,
      })

    it('should fetch details using sendMessage (fetch mode)', async () => {
      const conv = chatgptConv('c1', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      setupFetchModeMocks('chatgpt', 20)
      mockGetConversationById.mockResolvedValue(chatgptConv('c1', { detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('chatgpt')

      // Should use sendMessage (fetch mode), not tabs.update (navigate mode)
      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(20, {
        action: 'FETCH_CONVERSATION_DETAIL',
        url: 'https://chatgpt.com/backend-api/conversation/c1',
      })
      expect(mockBrowser.tabs.update).not.toHaveBeenCalled()
    })

    it('should not require org_id or init', async () => {
      const conv = chatgptConv('c1', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      setupFetchModeMocks('chatgpt', 20)
      mockGetConversationById.mockResolvedValue(chatgptConv('c1', { detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('chatgpt')

      // Should NOT check storage for org_id
      expect(mockBrowser.storage.local.get).not.toHaveBeenCalled()
      expect(mockExportData).toHaveBeenCalledWith({ type: 'full', platforms: ['chatgpt'] })
    })

    it('should error when no ChatGPT tab is open', async () => {
      mockGetConversations.mockResolvedValue([chatgptConv('c1', { detailStatus: 'none' })])
      mockBrowser.tabs.query.mockResolvedValue([])

      await batchFetchDetails('chatgpt')

      expect(mockNotifyExtensionPages).toHaveBeenCalledWith(
        'BATCH_FETCH_PROGRESS',
        expect.objectContaining({
          status: 'error',
          error: expect.stringContaining('No ChatGPT tab'),
        })
      )
    })

    it('should find tab on chat.openai.com fallback', async () => {
      const conv = chatgptConv('c1', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.tabs.query.mockImplementation(async (query: { url: string }) => {
        if (query.url === 'https://chatgpt.com/*') return []
        if (query.url === 'https://chat.openai.com/*') return [{ id: 30, active: true }]
        return []
      })
      mockBrowser.tabs.sendMessage.mockResolvedValue(undefined)
      mockGetConversationById.mockResolvedValue(chatgptConv('c1', { detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('chatgpt')

      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(30, expect.any(Object))
    })

    it('should handle multiple conversations with correct URLs', async () => {
      const conv1 = chatgptConv('c1', { detailStatus: 'none' })
      const conv2 = chatgptConv('c2', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv1, conv2])
      setupFetchModeMocks('chatgpt', 20)
      mockGetConversationById.mockImplementation(async (id: string) => {
        if (id === 'chatgpt_c1') return chatgptConv('c1', { detailStatus: 'full' })
        if (id === 'chatgpt_c2') return chatgptConv('c2', { detailStatus: 'full' })
        return null
      })
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('chatgpt')

      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledTimes(2)
      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(20, {
        action: 'FETCH_CONVERSATION_DETAIL',
        url: 'https://chatgpt.com/backend-api/conversation/c1',
      })
      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(20, {
        action: 'FETCH_CONVERSATION_DETAIL',
        url: 'https://chatgpt.com/backend-api/conversation/c2',
      })
    })
  })

  // ── batchFetchDetails: Gemini ──

  describe('batchFetchDetails - gemini', () => {
    const geminiConv = (id: string, overrides: Partial<Conversation> = {}) =>
      makeConversation({
        id: `gemini_${id}`,
        originalId: id,
        platform: 'gemini',
        ...overrides,
      })

    it('should use tabs.update (navigate mode) and wait for tab load', async () => {
      const conv = geminiConv('g1', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.tabs.query.mockImplementation(async (query: { url: string }) => {
        if (query.url === 'https://gemini.google.com/*') return [{ id: 40, active: false }]
        return []
      })
      mockBrowser.tabs.update.mockImplementation(async () => {
        setTimeout(() => simulateTabLoad(40), 5)
        return {}
      })
      mockGetConversationById.mockResolvedValue(geminiConv('g1', { detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('gemini')

      expect(mockBrowser.tabs.update).toHaveBeenCalledWith(40, {
        url: 'https://gemini.google.com/app/g1',
      })
      expect(mockBrowser.tabs.sendMessage).not.toHaveBeenCalled()
      // Should have registered an onUpdated listener for tab load
      expect(mockBrowser.tabs.onUpdated.addListener).toHaveBeenCalled()
    })

    it('should create background tab when no Gemini tab exists and wait for load', async () => {
      const conv = geminiConv('g1', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.tabs.query.mockResolvedValue([])
      setupNavigateTabCreate(50)
      mockGetConversationById.mockResolvedValue(geminiConv('g1', { detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('gemini')

      expect(mockBrowser.tabs.create).toHaveBeenCalledWith({
        url: 'https://gemini.google.com/',
        active: false,
      })
      expect(mockBrowser.tabs.update).toHaveBeenCalledWith(50, {
        url: 'https://gemini.google.com/app/g1',
      })
      // Should have used onUpdated listener (not setTimeout) for tab load
      expect(mockBrowser.tabs.onUpdated.addListener).toHaveBeenCalled()
    })

    it('should clean up created tab after batch completes', async () => {
      const conv = geminiConv('g1', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.tabs.query.mockResolvedValue([])
      setupNavigateTabCreate(50)
      mockGetConversationById.mockResolvedValue(geminiConv('g1', { detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('gemini')

      expect(mockBrowser.tabs.remove).toHaveBeenCalledWith(50)
    })

    it('should clean up created tab on cancel', async () => {
      const conv1 = geminiConv('g1', { detailStatus: 'none' })
      const conv2 = geminiConv('g2', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv1, conv2])
      mockBrowser.tabs.query.mockResolvedValue([])
      mockBrowser.tabs.create.mockImplementation(async () => {
        setTimeout(() => simulateTabLoad(50), 5)
        return { id: 50 }
      })
      mockBrowser.tabs.update.mockImplementation(async () => {
        cancelBatchFetch()
        setTimeout(() => simulateTabLoad(50), 5)
        return {}
      })
      mockBrowser.tabs.remove.mockResolvedValue(undefined)
      mockGetConversationById.mockResolvedValue(geminiConv('g1', { detailStatus: 'full' }))

      await batchFetchDetails('gemini')

      expect(mockBrowser.tabs.remove).toHaveBeenCalledWith(50)
    })

    it('should re-create tab on navigate failure instead of searching for another', async () => {
      const conv = geminiConv('g1', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.tabs.query.mockResolvedValue([])

      let createCount = 0
      mockBrowser.tabs.create.mockImplementation(async () => {
        createCount++
        const tabId = 50 + createCount
        setTimeout(() => simulateTabLoad(tabId), 5)
        return { id: tabId }
      })
      mockBrowser.tabs.remove.mockResolvedValue(undefined)

      // First update fails, second succeeds
      let updateCount = 0
      mockBrowser.tabs.update.mockImplementation(
        async (_tabId: number, _props: { url: string }) => {
          updateCount++
          if (updateCount === 1) {
            throw new Error('Tab crashed')
          }
          setTimeout(() => simulateTabLoad(_tabId), 5)
          return {}
        }
      )
      mockGetConversationById.mockResolvedValue(geminiConv('g1', { detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('gemini')

      // Should have created 2 tabs (initial + recovery)
      expect(mockBrowser.tabs.create).toHaveBeenCalledTimes(2)
      // Should have cleaned up the first failed tab
      expect(mockBrowser.tabs.remove).toHaveBeenCalledWith(51)
      // Should have used findPlatformTab 0 times for recovery (re-creates instead)
      // Final cleanup of the second tab
      expect(mockBrowser.tabs.remove).toHaveBeenCalledWith(52)
    })

    it('should not require org_id or any init', async () => {
      const conv = geminiConv('g1', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.tabs.query.mockImplementation(async (query: { url: string }) => {
        if (query.url === 'https://gemini.google.com/*') return [{ id: 40, active: false }]
        return []
      })
      mockBrowser.tabs.update.mockImplementation(async () => {
        setTimeout(() => simulateTabLoad(40), 5)
        return {}
      })
      mockGetConversationById.mockResolvedValue(geminiConv('g1', { detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('gemini')

      expect(mockBrowser.storage.local.get).not.toHaveBeenCalled()
    })

    it('should not create tab when existing Gemini tab found', async () => {
      const conv = geminiConv('g1', { detailStatus: 'none' })
      mockGetConversations.mockResolvedValue([conv])
      mockBrowser.tabs.query.mockImplementation(async (query: { url: string }) => {
        if (query.url === 'https://gemini.google.com/*') return [{ id: 40, active: false }]
        return []
      })
      mockBrowser.tabs.update.mockImplementation(async () => {
        setTimeout(() => simulateTabLoad(40), 5)
        return {}
      })
      mockGetConversationById.mockResolvedValue(geminiConv('g1', { detailStatus: 'full' }))
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('gemini')

      expect(mockBrowser.tabs.create).not.toHaveBeenCalled()
      expect(mockBrowser.tabs.remove).not.toHaveBeenCalled()
    })

    it('should generate export when all Gemini conversations have full details', async () => {
      mockGetConversations.mockResolvedValue([geminiConv('g1', { detailStatus: 'full' })])
      mockExportData.mockResolvedValue(makeExportResult())

      await batchFetchDetails('gemini')

      expect(mockExportData).toHaveBeenCalledWith({ type: 'full', platforms: ['gemini'] })
      expect(mockNotifyExtensionPages).toHaveBeenCalledWith(
        'BATCH_FETCH_PROGRESS',
        expect.objectContaining({ status: 'done' })
      )
    })
  })
})
