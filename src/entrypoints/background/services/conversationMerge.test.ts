import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Conversation, Message } from '@/types'
import { mergeConversation, upsertConversationMerged, applyConversationUpdate } from './conversationMerge'

// Mock database operations
vi.mock('@/utils/db', () => ({
  getConversationById: vi.fn(),
  getExistingMessageIds: vi.fn(),
  getMessagesByIds: vi.fn(),
  upsertConversation: vi.fn(),
  upsertMessages: vi.fn(),
}))

vi.mock('@/utils/message-dedupe', () => ({
  dedupeMessagesByContent: vi.fn((messages: Message[]) => messages),
}))

// Import mocked functions
const { getConversationById, upsertConversation, upsertMessages, getExistingMessageIds, getMessagesByIds } =
  await vi.importMock<typeof import('@/utils/db')>('@/utils/db')
const { dedupeMessagesByContent } =
  await vi.importMock<typeof import('@/utils/message-dedupe')>('@/utils/message-dedupe')

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'claude_abc',
    platform: 'claude',
    originalId: 'abc',
    title: 'Test Conversation',
    createdAt: 1000,
    updatedAt: 2000,
    messageCount: 5,
    preview: 'Hello world',
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

describe('conversationMerge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mergeConversation', () => {
    it('should use min createdAt from both', () => {
      const existing = makeConversation({ createdAt: 2000 })
      const incoming = makeConversation({ createdAt: 1000 })

      const result = mergeConversation(existing, incoming)
      expect(result.createdAt).toBe(1000)
    })

    it('should use max updatedAt from both', () => {
      const existing = makeConversation({ updatedAt: 1000 })
      const incoming = makeConversation({ updatedAt: 3000 })

      const result = mergeConversation(existing, incoming)
      expect(result.updatedAt).toBe(3000)
    })

    it('should use max syncedAt from both', () => {
      const existing = makeConversation({ syncedAt: 500 })
      const incoming = makeConversation({ syncedAt: 1500 })

      const result = mergeConversation(existing, incoming)
      expect(result.syncedAt).toBe(1500)
    })

    it('should use max messageCount from both', () => {
      const existing = makeConversation({ messageCount: 10 })
      const incoming = makeConversation({ messageCount: 5 })

      const result = mergeConversation(existing, incoming)
      expect(result.messageCount).toBe(10)
    })

    it('should OR isFavorite (either side favorite keeps it)', () => {
      const existing = makeConversation({ isFavorite: true, favoriteAt: 1000 })
      const incoming = makeConversation({ isFavorite: false })

      const result = mergeConversation(existing, incoming)
      expect(result.isFavorite).toBe(true)
    })

    it('should set favoriteAt when incoming makes it favorite', () => {
      const existing = makeConversation({ isFavorite: false })
      const incoming = makeConversation({ isFavorite: true, favoriteAt: 5000 })

      const result = mergeConversation(existing, incoming)
      expect(result.isFavorite).toBe(true)
      expect(result.favoriteAt).toBe(5000)
    })

    it('should clear favoriteAt when neither is favorite', () => {
      const existing = makeConversation({ isFavorite: false, favoriteAt: null })
      const incoming = makeConversation({ isFavorite: false, favoriteAt: null })

      const result = mergeConversation(existing, incoming)
      expect(result.favoriteAt).toBeNull()
    })

    it('should keep higher detailStatus rank', () => {
      const existing = makeConversation({ detailStatus: 'full', detailSyncedAt: 1000 })
      const incoming = makeConversation({ detailStatus: 'none', updatedAt: 1000 })

      const result = mergeConversation(existing, incoming)
      // incoming rank (0) < existing rank (2), but incoming is not newer, so full is kept
      expect(result.detailStatus).toBe('full')
    })

    it('should upgrade detailStatus when incoming has higher rank', () => {
      const existing = makeConversation({ detailStatus: 'none' })
      const incoming = makeConversation({ detailStatus: 'full', detailSyncedAt: 2000 })

      const result = mergeConversation(existing, incoming)
      expect(result.detailStatus).toBe('full')
    })

    it('should downgrade to partial when incoming is newer but lower rank than full', () => {
      const existing = makeConversation({ detailStatus: 'full', updatedAt: 1000, detailSyncedAt: 500 })
      const incoming = makeConversation({ detailStatus: 'none', updatedAt: 3000 })

      const result = mergeConversation(existing, incoming)
      expect(result.detailStatus).toBe('partial')
    })

    it('should use newer preview when incoming is newer', () => {
      const existing = makeConversation({ updatedAt: 1000, preview: 'Old preview' })
      const incoming = makeConversation({ updatedAt: 2000, preview: 'New preview' })

      const result = mergeConversation(existing, incoming)
      expect(result.preview).toBe('New preview')
    })

    it('should keep existing preview when incoming is older', () => {
      const existing = makeConversation({ updatedAt: 2000, preview: 'Existing' })
      const incoming = makeConversation({ updatedAt: 1000, preview: 'Older' })

      const result = mergeConversation(existing, incoming)
      expect(result.preview).toBe('Existing')
    })

    it('should use incoming title by default', () => {
      const existing = makeConversation({ title: 'Old Title' })
      const incoming = makeConversation({ title: 'New Title' })

      const result = mergeConversation(existing, incoming)
      expect(result.title).toBe('New Title')
    })

    it('should keep existing title for Gemini when incoming looks like an ID', () => {
      const existing = makeConversation({ platform: 'gemini', title: 'Good Title' })
      const incoming = makeConversation({ platform: 'gemini', title: 'rc_abc123', preview: 'Hello' })

      const result = mergeConversation(existing, incoming)
      expect(result.title).toBe('Good Title')
    })

    it('should keep existing title for Gemini when incoming title matches preview prefix', () => {
      const existing = makeConversation({ platform: 'gemini', title: 'My Topic' })
      const incoming = makeConversation({ platform: 'gemini', title: 'Hello', preview: 'Hello world how are you' })

      const result = mergeConversation(existing, incoming)
      expect(result.title).toBe('My Topic')
    })

    it('should keep existing title for Gemini when incoming title is very short', () => {
      const existing = makeConversation({ platform: 'gemini', title: 'Proper Title' })
      const incoming = makeConversation({ platform: 'gemini', title: 'Hi', preview: 'Something different' })

      const result = mergeConversation(existing, incoming)
      expect(result.title).toBe('Proper Title')
    })

    it('should preserve existing url if present', () => {
      const existing = makeConversation({ url: 'https://claude.ai/chat/abc' })
      const incoming = makeConversation({ url: 'https://claude.ai/chat/def' })

      const result = mergeConversation(existing, incoming)
      expect(result.url).toBe('https://claude.ai/chat/abc')
    })

    it('should use incoming url when existing has none', () => {
      const existing = makeConversation({})
      const incoming = makeConversation({ url: 'https://claude.ai/chat/abc' })

      const result = mergeConversation(existing, incoming)
      expect(result.url).toBe('https://claude.ai/chat/abc')
    })
  })

  describe('upsertConversationMerged', () => {
    it('should insert directly when no existing conversation', async () => {
      getConversationById.mockResolvedValue(undefined)
      const conv = makeConversation()

      await upsertConversationMerged(conv)

      expect(upsertConversation).toHaveBeenCalledWith(conv)
    })

    it('should merge when existing conversation found', async () => {
      const existing = makeConversation({ title: 'Old', updatedAt: 1000 })
      getConversationById.mockResolvedValue(existing)
      const incoming = makeConversation({ title: 'New', updatedAt: 2000 })

      await upsertConversationMerged(incoming)

      expect(upsertConversation).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New', updatedAt: 2000 }),
      )
    })
  })

  describe('applyConversationUpdate', () => {
    it('should set detailStatus to full for full mode', async () => {
      getConversationById.mockResolvedValue(undefined)
      const conv = makeConversation({ detailStatus: 'none' })
      const messages: Message[] = []

      await applyConversationUpdate(conv, messages, 'full')

      expect(upsertConversation).toHaveBeenCalledWith(
        expect.objectContaining({ detailStatus: 'full' }),
      )
    })

    it('should set detailStatus to partial for partial mode', async () => {
      getConversationById.mockResolvedValue(undefined)
      const conv = makeConversation({ detailStatus: 'none' })
      const messages: Message[] = []

      await applyConversationUpdate(conv, messages, 'partial')

      expect(upsertConversation).toHaveBeenCalledWith(
        expect.objectContaining({ detailStatus: 'partial' }),
      )
    })

    it('should skip message processing when no messages', async () => {
      getConversationById.mockResolvedValue(undefined)
      const conv = makeConversation()

      await applyConversationUpdate(conv, [], 'full')

      expect(upsertMessages).not.toHaveBeenCalled()
    })

    it('should upsert messages when provided', async () => {
      const conv = makeConversation()
      const messages = [
        makeMessage({ id: 'msg_1', role: 'user', content: 'Hello' }),
        makeMessage({ id: 'msg_2', role: 'assistant', content: 'Hi' }),
      ]
      getConversationById.mockResolvedValue(conv)
      getMessagesByIds.mockResolvedValue(new Map())

      await applyConversationUpdate(conv, messages, 'full')

      expect(upsertMessages).toHaveBeenCalledWith(messages)
    })

    it('should dedupe Gemini messages', async () => {
      const conv = makeConversation({ platform: 'gemini' })
      const messages = [makeMessage({ id: 'msg_1' })]
      const existingMap = new Map<string, Message>()
      getConversationById.mockResolvedValue(conv)
      getMessagesByIds.mockResolvedValue(existingMap)
      dedupeMessagesByContent.mockReturnValue(messages)

      await applyConversationUpdate(conv, messages, 'full')

      expect(dedupeMessagesByContent).toHaveBeenCalledWith(messages, existingMap)
    })

    it('should not dedupe non-Gemini messages', async () => {
      const conv = makeConversation({ platform: 'claude' })
      const messages = [makeMessage({ id: 'msg_1' })]
      getConversationById.mockResolvedValue(conv)

      await applyConversationUpdate(conv, messages, 'full')

      expect(dedupeMessagesByContent).not.toHaveBeenCalled()
    })

    it('should check existing message IDs in partial mode', async () => {
      const conv = makeConversation()
      const messages = [makeMessage({ id: 'msg_1' })]
      getConversationById.mockResolvedValue(conv)
      getExistingMessageIds.mockResolvedValue(new Set<string>())

      await applyConversationUpdate(conv, messages, 'partial')

      expect(getExistingMessageIds).toHaveBeenCalledWith(['msg_1'])
    })

    it('should not check existing IDs in full mode', async () => {
      const conv = makeConversation()
      const messages = [makeMessage({ id: 'msg_1' })]
      getConversationById.mockResolvedValue(conv)

      await applyConversationUpdate(conv, messages, 'full')

      expect(getExistingMessageIds).not.toHaveBeenCalled()
    })

    it('should update conversation metadata from messages in full mode', async () => {
      const conv = makeConversation({ preview: 'old', messageCount: 1, updatedAt: 1000 })
      const messages = [
        makeMessage({ id: 'msg_1', role: 'user', content: 'New content', createdAt: 5000 }),
        makeMessage({ id: 'msg_2', role: 'assistant', content: 'Response', createdAt: 6000 }),
      ]
      getConversationById.mockResolvedValue(undefined) // first call for upsertMerged
        .mockResolvedValue(conv) // second call for updateFromMessages

      await applyConversationUpdate(conv, messages, 'full')

      // Should upsert with updated metadata - the second upsertConversation call
      // updates metadata from messages
      expect(upsertConversation).toHaveBeenCalledTimes(2)
    })
  })
})
