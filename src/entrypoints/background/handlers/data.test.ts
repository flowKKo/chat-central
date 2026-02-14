import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Conversation, Message } from '@/types'
import {
  handleGetConversations,
  handleGetMessages,
  handleGetStats,
  handleSearch,
  handleSearchWithMatches,
  handleGetRecentConversations,
  handleToggleFavorite,
  handleUpdateTags,
  handleGetAllTags,
} from './data'

// Mock database operations
vi.mock('@/utils/db', () => ({
  getConversations: vi.fn(),
  getMessagesByConversationId: vi.fn(),
  getDBStats: vi.fn(),
  getConversationById: vi.fn(),
  updateConversationFavorite: vi.fn(),
  updateConversationTags: vi.fn(),
  getAllTags: vi.fn(),
  searchConversations: vi.fn(),
  searchConversationsWithMatches: vi.fn(),
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
  getConversations,
  getMessagesByConversationId,
  getDBStats,
  getConversationById,
  updateConversationFavorite,
  updateConversationTags,
  getAllTags,
  searchConversations,
  searchConversationsWithMatches,
} = await vi.importMock<typeof import('@/utils/db')>('@/utils/db')

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'claude_abc',
    platform: 'claude',
    originalId: 'abc',
    title: 'Test Conv',
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

describe('data handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleGetConversations', () => {
    it('should return conversations with valid message', async () => {
      const convs = [makeConversation()]
      getConversations.mockResolvedValue(convs)

      const result = await handleGetConversations({
        action: 'GET_CONVERSATIONS',
        platform: 'claude',
        limit: 20,
      })

      expect(result).toEqual({ conversations: convs })
      expect(getConversations).toHaveBeenCalledWith({
        platform: 'claude',
        limit: 20,
        offset: undefined,
      })
    })

    it('should return error for invalid message format', async () => {
      const result = await handleGetConversations({ action: 'INVALID' })
      expect(result).toEqual({ error: 'Invalid message format' })
    })

    it('should work without optional parameters', async () => {
      getConversations.mockResolvedValue([])

      const result = await handleGetConversations({ action: 'GET_CONVERSATIONS' })

      expect(result).toEqual({ conversations: [] })
      expect(getConversations).toHaveBeenCalledWith({
        platform: undefined,
        limit: undefined,
        offset: undefined,
      })
    })
  })

  describe('handleGetMessages', () => {
    it('should return messages for valid conversationId', async () => {
      const messages: Message[] = [
        { id: 'msg_1', conversationId: 'c1', role: 'user', content: 'Hi', createdAt: 1000 },
      ]
      getMessagesByConversationId.mockResolvedValue(messages)

      const result = await handleGetMessages({
        action: 'GET_MESSAGES',
        conversationId: 'c1',
      })

      expect(result).toEqual({ messages })
    })

    it('should return error for missing conversationId', async () => {
      const result = await handleGetMessages({
        action: 'GET_MESSAGES',
        conversationId: '',
      })

      expect(result).toEqual({ error: 'Invalid message format' })
    })

    it('should return error for invalid format', async () => {
      const result = await handleGetMessages({ action: 'WRONG' })
      expect(result).toEqual({ error: 'Invalid message format' })
    })
  })

  describe('handleGetStats', () => {
    it('should return stats', async () => {
      const stats = {
        totalConversations: 100,
        totalMessages: 500,
        byPlatform: { claude: 50, chatgpt: 30, gemini: 20 },
        oldestConversation: 1000,
        newestConversation: 9000,
      }
      getDBStats.mockResolvedValue(stats)

      const result = await handleGetStats()
      expect(result).toEqual({ stats })
    })
  })

  describe('handleSearch', () => {
    it('should return search results from searchConversations', async () => {
      const matched = [
        makeConversation({ id: 'c1', title: 'React hooks guide' }),
        makeConversation({ id: 'c3', title: 'CSS tricks', preview: 'Cool react tips' }),
      ]
      searchConversations.mockResolvedValue(matched)

      const result = await handleSearch({
        action: 'SEARCH',
        query: 'react',
      })

      expect(searchConversations).toHaveBeenCalledWith('react')
      expect(result).toHaveProperty('results')
      const results = (result as { results: Conversation[] }).results
      expect(results).toHaveLength(2)
      expect(results.map((r) => r.id)).toEqual(['c1', 'c3'])
    })

    it('should pass query to searchConversations', async () => {
      searchConversations.mockResolvedValue([makeConversation({ title: 'UPPERCASE Title' })])

      const result = await handleSearch({
        action: 'SEARCH',
        query: 'uppercase',
      })

      expect(searchConversations).toHaveBeenCalledWith('uppercase')
      expect((result as { results: Conversation[] }).results).toHaveLength(1)
    })

    it('should return error for invalid format', async () => {
      const result = await handleSearch({ action: 'WRONG' })
      expect(result).toEqual({ error: 'Invalid message format' })
    })
  })

  describe('handleToggleFavorite', () => {
    it('should toggle favorite status', async () => {
      const conv = makeConversation({ isFavorite: false })
      getConversationById.mockResolvedValue(conv)
      const updated = { ...conv, isFavorite: true, favoriteAt: 5000 }
      updateConversationFavorite.mockResolvedValue(updated)

      const result = await handleToggleFavorite({
        action: 'TOGGLE_FAVORITE',
        conversationId: 'claude_abc',
      })

      expect(result).toEqual({ success: true, conversation: updated })
      expect(updateConversationFavorite).toHaveBeenCalledWith('claude_abc', true)
    })

    it('should use explicit value when provided', async () => {
      const conv = makeConversation({ isFavorite: true })
      getConversationById.mockResolvedValue(conv)
      updateConversationFavorite.mockResolvedValue({ ...conv, isFavorite: false })

      await handleToggleFavorite({
        action: 'TOGGLE_FAVORITE',
        conversationId: 'claude_abc',
        value: false,
      })

      expect(updateConversationFavorite).toHaveBeenCalledWith('claude_abc', false)
    })

    it('should return false when conversation not found', async () => {
      getConversationById.mockResolvedValue(undefined)

      const result = await handleToggleFavorite({
        action: 'TOGGLE_FAVORITE',
        conversationId: 'nonexistent',
      })

      expect(result).toEqual({ success: false, conversation: null })
    })

    it('should return error for invalid format', async () => {
      const result = await handleToggleFavorite({ action: 'WRONG' })
      expect(result).toEqual({ success: false, error: 'Invalid message format' })
    })
  })

  describe('handleUpdateTags', () => {
    it('should update conversation tags', async () => {
      const updated = makeConversation({ tags: ['react', 'hooks'] })
      updateConversationTags.mockResolvedValue(updated)

      const result = await handleUpdateTags({
        action: 'UPDATE_TAGS',
        conversationId: 'claude_abc',
        tags: ['react', 'hooks'],
      })

      expect(result).toEqual({ success: true, conversation: updated })
    })

    it('should return false when conversation not found', async () => {
      updateConversationTags.mockResolvedValue(null)

      const result = await handleUpdateTags({
        action: 'UPDATE_TAGS',
        conversationId: 'nonexistent',
        tags: ['tag1'],
      })

      expect(result).toEqual({ success: false, conversation: null })
    })

    it('should return error for invalid format', async () => {
      const result = await handleUpdateTags({ action: 'WRONG' })
      expect(result).toEqual({ success: false, error: 'Invalid message format' })
    })

    it('should reject empty tags after trimming', async () => {
      const result = await handleUpdateTags({
        action: 'UPDATE_TAGS',
        conversationId: 'c1',
        tags: ['  '],
      })

      expect(result).toEqual({ success: false, error: 'Invalid message format' })
    })
  })

  describe('handleGetAllTags', () => {
    it('should return all tags', async () => {
      getAllTags.mockResolvedValue(['react', 'vue', 'css'])

      const result = await handleGetAllTags()
      expect(result).toEqual({ tags: ['react', 'vue', 'css'] })
    })

    it('should return empty array when no tags', async () => {
      getAllTags.mockResolvedValue([])

      const result = await handleGetAllTags()
      expect(result).toEqual({ tags: [] })
    })
  })

  describe('handleSearchWithMatches', () => {
    it('should return search results with matches', async () => {
      const conv = makeConversation({ title: 'React hooks guide' })
      const searchResults = [
        { conversation: conv, matches: [{ type: 'title' as const, text: 'React hooks guide' }] },
      ]
      searchConversationsWithMatches.mockResolvedValue(searchResults)

      const result = await handleSearchWithMatches({
        action: 'SEARCH_WITH_MATCHES',
        query: 'react',
      })

      expect(searchConversationsWithMatches).toHaveBeenCalledWith('react')
      expect(result).toEqual({ results: searchResults })
    })

    it('should respect limit parameter', async () => {
      const results = Array.from({ length: 5 }, (_, i) => ({
        conversation: makeConversation({ id: `c${i}` }),
        matches: [{ type: 'title' as const, text: `Conv ${i}` }],
      }))
      searchConversationsWithMatches.mockResolvedValue(results)

      const result = await handleSearchWithMatches({
        action: 'SEARCH_WITH_MATCHES',
        query: 'test',
        limit: 2,
      })

      const res = result as { results: unknown[] }
      expect(res.results).toHaveLength(2)
    })

    it('should return error for empty query', async () => {
      const result = await handleSearchWithMatches({
        action: 'SEARCH_WITH_MATCHES',
        query: '',
      })

      expect(result).toEqual({ error: 'Invalid message format' })
    })

    it('should return error for invalid format', async () => {
      const result = await handleSearchWithMatches({ action: 'WRONG' })
      expect(result).toEqual({ error: 'Invalid message format' })
    })
  })

  describe('handleGetRecentConversations', () => {
    it('should return recent conversations with default limit', async () => {
      const convs = [makeConversation()]
      getConversations.mockResolvedValue(convs)

      const result = await handleGetRecentConversations({
        action: 'GET_RECENT_CONVERSATIONS',
      })

      expect(result).toEqual({ conversations: convs })
      expect(getConversations).toHaveBeenCalledWith({ limit: 10, orderBy: 'updatedAt' })
    })

    it('should respect custom limit', async () => {
      getConversations.mockResolvedValue([])

      await handleGetRecentConversations({
        action: 'GET_RECENT_CONVERSATIONS',
        limit: 5,
      })

      expect(getConversations).toHaveBeenCalledWith({ limit: 5, orderBy: 'updatedAt' })
    })

    it('should return error for invalid format', async () => {
      const result = await handleGetRecentConversations({ action: 'WRONG' })
      expect(result).toEqual({ error: 'Invalid message format' })
    })
  })
})
