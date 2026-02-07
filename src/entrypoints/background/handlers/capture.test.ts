import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Conversation, Message } from '@/types'
import { handleCapturedResponse } from './capture'

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      local: {
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({}),
      },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

// Mock platform adapters
vi.mock('@/utils/platform-adapters', () => ({
  getAdapterForUrl: vi.fn(),
}))

// Mock services
vi.mock('../services', () => ({
  upsertConversationsMerged: vi.fn(),
  applyConversationUpdate: vi.fn(),
}))

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const { getAdapterForUrl } = await vi.importMock<typeof import('@/utils/platform-adapters')>(
  '@/utils/platform-adapters'
)
const { upsertConversationsMerged, applyConversationUpdate } =
  await vi.importMock<typeof import('../services')>('../services')

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

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg_1',
    conversationId: 'claude_abc',
    role: 'user',
    content: 'Hello',
    createdAt: 1000,
    ...overrides,
  }
}

function makeAdapter(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'claude' as const,
    shouldCapture: vi.fn().mockReturnValue(true),
    getEndpointType: vi.fn().mockReturnValue('list'),
    parseConversationList: vi.fn().mockReturnValue([]),
    parseConversationDetail: vi.fn().mockReturnValue(null),
    parseStreamResponse: vi.fn().mockReturnValue(null),
    extractConversationId: vi.fn().mockReturnValue(null),
    buildConversationUrl: vi.fn().mockReturnValue(''),
    ...overrides,
  }
}

function validCaptureMessage(url = 'https://claude.ai/api/conversations', data: unknown = {}) {
  return {
    action: 'CAPTURE_API_RESPONSE' as const,
    url,
    data,
    timestamp: Date.now(),
  }
}

describe('capture handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleCapturedResponse', () => {
    it('should return error for invalid message format', async () => {
      const result = await handleCapturedResponse({ action: 'WRONG' })
      expect(result).toEqual({ success: false, error: 'Invalid message format' })
    })

    it('should return error when no adapter found', async () => {
      getAdapterForUrl.mockReturnValue(null)

      const result = await handleCapturedResponse(validCaptureMessage())
      expect(result).toEqual({ success: false })
    })

    it('should process conversation list endpoint', async () => {
      const convs = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })]
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('list'),
        parseConversationList: vi.fn().mockReturnValue(convs),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())

      expect(result).toEqual({ success: true, count: 2 })
      expect(upsertConversationsMerged).toHaveBeenCalledTimes(1)
      expect(upsertConversationsMerged).toHaveBeenCalledWith(expect.any(Array))
    })

    it('should return count 0 for empty conversation list', async () => {
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('list'),
        parseConversationList: vi.fn().mockReturnValue([]),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())
      expect(result).toEqual({ success: true, count: 0 })
    })

    it('should process conversation detail endpoint', async () => {
      const conv = makeConversation()
      const messages = [makeMessage(), makeMessage({ id: 'msg_2' })]
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('detail'),
        parseConversationDetail: vi.fn().mockReturnValue({ conversation: conv, messages }),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())

      expect(result).toEqual({ success: true, count: 2 })
      expect(applyConversationUpdate).toHaveBeenCalledWith(conv, messages, 'full')
    })

    it('should handle failed detail parsing', async () => {
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('detail'),
        parseConversationDetail: vi.fn().mockReturnValue(null),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())
      expect(result).toEqual({ success: false, count: 0 })
    })

    it('should process stream endpoint', async () => {
      const conv = makeConversation()
      const messages = [makeMessage()]
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('stream'),
        parseStreamResponse: vi.fn().mockReturnValue({ conversation: conv, messages }),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())

      expect(result).toEqual({ success: true, count: 1 })
      expect(applyConversationUpdate).toHaveBeenCalledWith(conv, messages, 'partial')
    })

    it('should handle adapter without stream support', async () => {
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('stream'),
        parseStreamResponse: undefined,
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())
      expect(result).toEqual({ success: false, count: 0 })
    })

    it('should try all parsers for unknown endpoint type', async () => {
      const conv = makeConversation()
      const messages = [makeMessage()]
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('unknown'),
        parseConversationDetail: vi.fn().mockReturnValue({ conversation: conv, messages }),
        parseConversationList: vi.fn().mockReturnValue([]),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())

      expect(result).toEqual({ success: true, count: 1 })
      expect(applyConversationUpdate).toHaveBeenCalledWith(conv, messages, 'full')
    })

    it('should try stream as last fallback for unknown endpoint', async () => {
      const conv = makeConversation()
      const messages = [makeMessage()]
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('unknown'),
        parseConversationDetail: vi.fn().mockReturnValue(null),
        parseConversationList: vi.fn().mockReturnValue([]),
        parseStreamResponse: vi.fn().mockReturnValue({ conversation: conv, messages }),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())

      expect(result).toEqual({ success: true, count: 1 })
      expect(applyConversationUpdate).toHaveBeenCalledWith(conv, messages, 'partial')
    })

    it('should return not handled when all parsers fail for unknown type', async () => {
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('unknown'),
        parseConversationDetail: vi.fn().mockReturnValue(null),
        parseConversationList: vi.fn().mockReturnValue([]),
        parseStreamResponse: vi.fn().mockReturnValue(null),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())
      expect(result).toEqual({ success: false, count: 0 })
    })

    it('should catch errors and return failure', async () => {
      const adapter = makeAdapter({
        getEndpointType: vi.fn().mockReturnValue('list'),
        parseConversationList: vi.fn().mockImplementation(() => {
          throw new Error('Parse error')
        }),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      const result = await handleCapturedResponse(validCaptureMessage())
      expect(result).toEqual({ success: false })
    })

    it('should extract and store org_id from Claude URLs', async () => {
      const { browser } = await vi.importMock<typeof import('wxt/browser')>('wxt/browser')
      const adapter = makeAdapter({
        platform: 'claude',
        getEndpointType: vi.fn().mockReturnValue('list'),
        parseConversationList: vi.fn().mockReturnValue([]),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      await handleCapturedResponse(
        validCaptureMessage('https://claude.ai/api/organizations/abc-123-def/chat_conversations')
      )

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        claude_org_id: 'abc-123-def',
      })
    })

    it('should not extract org_id for non-claude adapters', async () => {
      const { browser } = await vi.importMock<typeof import('wxt/browser')>('wxt/browser')
      const adapter = makeAdapter({
        platform: 'chatgpt',
        getEndpointType: vi.fn().mockReturnValue('list'),
        parseConversationList: vi.fn().mockReturnValue([]),
      })
      getAdapterForUrl.mockReturnValue(adapter)

      await handleCapturedResponse(
        validCaptureMessage('https://chatgpt.com/backend-api/conversations')
      )

      expect(browser.storage.local.set).not.toHaveBeenCalled()
    })
  })
})
