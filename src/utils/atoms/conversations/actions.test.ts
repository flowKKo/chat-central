import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import type { Conversation } from '@/types'
import * as db from '@/utils/db'
import { browser } from 'wxt/browser'
import {
  loadAllTagsAtom,
  toggleTagFilterAtom,
  clearTagFiltersAtom,
  setDateRangeAtom,
  clearAllFiltersAtom,
  loadConversationsAtom,
  performSearchAtom,
  clearSearchAtom,
  clearSelectionAtom,
  updateConversationAtom,
  toggleFavoriteAtom,
  loadConversationDetailAtom,
  updateTagsAtom,
} from './actions'
import {
  allTagsAtom,
  filtersAtom,
  conversationsAtom,
  isLoadingConversationsAtom,
  paginationAtom,
  conversationCountsAtom,
  activeSearchQueryAtom,
  searchResultsAtom,
  selectedConversationIdAtom,
  selectedConversationAtom,
  selectedMessagesAtom,
  isLoadingDetailAtom,
  favoritesConversationsAtom,
} from './state'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
    },
  },
}))

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/utils/db', () => ({
  getAllTags: vi.fn().mockResolvedValue([]),
  getConversations: vi.fn().mockResolvedValue([]),
  getConversationCount: vi.fn().mockResolvedValue(0),
  getFavoriteConversationCount: vi.fn().mockResolvedValue(0),
  searchConversationsWithMatches: vi.fn().mockResolvedValue([]),
  getMessagesByConversationId: vi.fn().mockResolvedValue([]),
  upsertMessages: vi.fn().mockResolvedValue(undefined),
  deleteMessagesByConversationId: vi.fn().mockResolvedValue(undefined),
}))

// ============================================================================
// Helpers
// ============================================================================

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    originalId: 'orig-1',
    platform: 'claude',
    title: 'Test Conversation',
    preview: 'Preview text',
    messageCount: 5,
    createdAt: 1000,
    updatedAt: 2000,
    url: 'https://example.com',
    isFavorite: false,
    favoriteAt: null,
    tags: [],
    syncedAt: 0,
    detailStatus: 'none',
    detailSyncedAt: null,
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('conversation actions', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    vi.clearAllMocks()
    store = createStore()
  })

  // ==========================================================================
  // Filter Actions
  // ==========================================================================

  describe('loadAllTagsAtom', () => {
    it('should load tags from database', async () => {
      vi.mocked(db.getAllTags).mockResolvedValue(['work', 'personal', 'ai'])

      await store.set(loadAllTagsAtom)

      expect(store.get(allTagsAtom)).toEqual(['work', 'personal', 'ai'])
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(db.getAllTags).mockRejectedValue(new Error('DB error'))

      await store.set(loadAllTagsAtom)

      expect(store.get(allTagsAtom)).toEqual([])
    })
  })

  describe('toggleTagFilterAtom', () => {
    it('should add a tag to filters', () => {
      store.set(toggleTagFilterAtom, 'work')

      expect(store.get(filtersAtom).tags).toEqual(['work'])
    })

    it('should remove a tag if already present', () => {
      store.set(filtersAtom, {
        platforms: [],
        dateRange: { start: null, end: null },
        tags: ['work'],
      })
      store.set(toggleTagFilterAtom, 'work')

      expect(store.get(filtersAtom).tags).toEqual([])
    })

    it('should toggle multiple tags', () => {
      store.set(toggleTagFilterAtom, 'work')
      store.set(toggleTagFilterAtom, 'personal')

      expect(store.get(filtersAtom).tags).toEqual(['work', 'personal'])
    })
  })

  describe('clearTagFiltersAtom', () => {
    it('should clear all tag filters', () => {
      store.set(filtersAtom, {
        platforms: ['claude'],
        dateRange: { start: null, end: null },
        tags: ['work', 'personal'],
      })

      store.set(clearTagFiltersAtom)

      const filters = store.get(filtersAtom)
      expect(filters.tags).toEqual([])
      // Other filters should be preserved
      expect(filters.platforms).toEqual(['claude'])
    })
  })

  describe('setDateRangeAtom', () => {
    it('should set date range', () => {
      store.set(setDateRangeAtom, { start: 1000, end: 2000 })

      expect(store.get(filtersAtom).dateRange).toEqual({ start: 1000, end: 2000 })
    })

    it('should clear date range with nulls', () => {
      store.set(setDateRangeAtom, { start: 1000, end: 2000 })
      store.set(setDateRangeAtom, { start: null, end: null })

      expect(store.get(filtersAtom).dateRange).toEqual({ start: null, end: null })
    })
  })

  describe('clearAllFiltersAtom', () => {
    it('should reset all filters to defaults', () => {
      store.set(filtersAtom, {
        platforms: ['claude'],
        dateRange: { start: 1000, end: 2000 },
        tags: ['work'],
      })

      store.set(clearAllFiltersAtom)

      expect(store.get(filtersAtom)).toEqual({
        platforms: [],
        dateRange: { start: null, end: null },
        tags: [],
      })
    })
  })

  // ==========================================================================
  // Conversation Loading
  // ==========================================================================

  describe('loadConversationsAtom', () => {
    it('should load conversations and set loading state', async () => {
      const convs = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })]
      vi.mocked(db.getConversations).mockResolvedValue(convs)
      vi.mocked(db.getConversationCount).mockResolvedValue(2)

      await store.set(loadConversationsAtom, { reset: true })

      expect(store.get(isLoadingConversationsAtom)).toBe(false)
      expect(store.get(conversationsAtom)).toEqual(convs)
    })

    it('should update counts after loading', async () => {
      vi.mocked(db.getConversations).mockResolvedValue([])
      vi.mocked(db.getConversationCount)
        .mockResolvedValueOnce(5) // claude
        .mockResolvedValueOnce(3) // chatgpt
        .mockResolvedValueOnce(2) // gemini
        .mockResolvedValueOnce(10) // total

      await store.set(loadConversationsAtom, { reset: true })

      expect(store.get(conversationCountsAtom)).toEqual({
        claude: 5,
        chatgpt: 3,
        gemini: 2,
        total: 10,
      })
    })

    it('should append conversations when not reset', async () => {
      store.set(conversationsAtom, [makeConversation({ id: 'c1' })])

      const newConvs = [makeConversation({ id: 'c2' })]
      vi.mocked(db.getConversations).mockResolvedValue(newConvs)

      await store.set(loadConversationsAtom)

      expect(store.get(conversationsAtom)).toHaveLength(2)
    })

    it('should detect hasMore from extra record', async () => {
      // Returns 21 records (limit + 1), indicating more exist
      const convs = Array.from({ length: 21 }, (_, i) => makeConversation({ id: `c${i}` }))
      vi.mocked(db.getConversations).mockResolvedValue(convs)

      await store.set(loadConversationsAtom, { reset: true })

      expect(store.get(paginationAtom).hasMore).toBe(true)
      expect(store.get(conversationsAtom)).toHaveLength(20) // Only 20, not 21
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(db.getConversations).mockRejectedValue(new Error('DB error'))

      await store.set(loadConversationsAtom, { reset: true })

      expect(store.get(isLoadingConversationsAtom)).toBe(false)
    })
  })

  // ==========================================================================
  // Search
  // ==========================================================================

  describe('performSearchAtom', () => {
    it('should search and set results', async () => {
      const conv = makeConversation({ id: 'c1', title: 'AI chat' })
      const results = [{ conversation: conv, matches: [] }]
      vi.mocked(db.searchConversationsWithMatches).mockResolvedValue(results)

      await store.set(performSearchAtom, 'AI')

      expect(store.get(activeSearchQueryAtom)).toBe('AI')
      expect(store.get(conversationsAtom)).toEqual([conv])
    })

    it('should reload conversations when query has only operators', async () => {
      vi.mocked(db.getConversations).mockResolvedValue([])
      vi.mocked(db.getConversationCount).mockResolvedValue(0)

      await store.set(performSearchAtom, 'platform:claude')

      expect(store.get(activeSearchQueryAtom)).toBe('')
      expect(store.get(filtersAtom).platforms).toEqual(['claude'])
    })

    it('should filter favorites when is:favorite is used', async () => {
      const favConv = makeConversation({ id: 'c1', isFavorite: true })
      const nonFavConv = makeConversation({ id: 'c2', isFavorite: false })
      vi.mocked(db.searchConversationsWithMatches).mockResolvedValue([
        { conversation: favConv, matches: [] },
        { conversation: nonFavConv, matches: [] },
      ])

      await store.set(performSearchAtom, 'is:favorite test')

      expect(store.get(conversationsAtom)).toEqual([favConv])
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(db.searchConversationsWithMatches).mockRejectedValue(new Error('Search error'))

      await store.set(performSearchAtom, 'test')

      expect(store.get(isLoadingConversationsAtom)).toBe(false)
    })
  })

  describe('clearSearchAtom', () => {
    it('should clear search state and reload', async () => {
      store.set(activeSearchQueryAtom, 'test')
      store.set(searchResultsAtom, [{ conversation: makeConversation(), matches: [] }])

      vi.mocked(db.getConversations).mockResolvedValue([])
      vi.mocked(db.getConversationCount).mockResolvedValue(0)

      await store.set(clearSearchAtom)

      expect(store.get(activeSearchQueryAtom)).toBe('')
      expect(store.get(searchResultsAtom)).toEqual([])
    })
  })

  // ==========================================================================
  // Conversation Detail
  // ==========================================================================

  describe('loadConversationDetailAtom', () => {
    it('should load messages for a conversation', async () => {
      const conv = makeConversation({ id: 'c1' })
      store.set(conversationsAtom, [conv])

      const messages = [
        { id: 'm1', conversationId: 'c1', role: 'user' as const, content: 'Hello', createdAt: 1 },
      ]
      vi.mocked(db.getMessagesByConversationId).mockResolvedValue(messages)

      await store.set(loadConversationDetailAtom, 'c1')

      expect(store.get(selectedConversationIdAtom)).toBe('c1')
      expect(store.get(selectedConversationAtom)).toEqual(conv)
      expect(store.get(selectedMessagesAtom)).toEqual(messages)
      expect(store.get(isLoadingDetailAtom)).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(db.getMessagesByConversationId).mockRejectedValue(new Error('error'))

      await store.set(loadConversationDetailAtom, 'c1')

      expect(store.get(isLoadingDetailAtom)).toBe(false)
    })
  })

  describe('clearSelectionAtom', () => {
    it('should clear all selection state', () => {
      store.set(selectedConversationIdAtom, 'c1')
      store.set(selectedConversationAtom, makeConversation())
      store.set(selectedMessagesAtom, [
        { id: 'm1', conversationId: 'c1', role: 'user', content: 'Hi', createdAt: 1 },
      ])

      store.set(clearSelectionAtom)

      expect(store.get(selectedConversationIdAtom)).toBeNull()
      expect(store.get(selectedConversationAtom)).toBeNull()
      expect(store.get(selectedMessagesAtom)).toEqual([])
    })
  })

  // ==========================================================================
  // Conversation Updates
  // ==========================================================================

  describe('updateConversationAtom', () => {
    it('should update conversation in all lists', () => {
      const conv = makeConversation({ id: 'c1', title: 'Old' })
      store.set(conversationsAtom, [conv])
      store.set(favoritesConversationsAtom, [conv])

      const updated = { ...conv, title: 'New' }
      store.set(updateConversationAtom, updated)

      expect(store.get(conversationsAtom)[0]!.title).toBe('New')
      expect(store.get(favoritesConversationsAtom)[0]!.title).toBe('New')
    })

    it('should update selected conversation if it matches', () => {
      const conv = makeConversation({ id: 'c1', title: 'Old' })
      store.set(selectedConversationAtom, conv)

      const updated = { ...conv, title: 'New' }
      store.set(updateConversationAtom, updated)

      expect(store.get(selectedConversationAtom)?.title).toBe('New')
    })

    it('should not update selected conversation if it does not match', () => {
      const conv = makeConversation({ id: 'c1', title: 'Selected' })
      store.set(selectedConversationAtom, conv)

      const updated = makeConversation({ id: 'c2', title: 'Other' })
      store.set(updateConversationAtom, updated)

      expect(store.get(selectedConversationAtom)?.title).toBe('Selected')
    })
  })

  describe('toggleFavoriteAtom', () => {
    it('should toggle favorite via runtime message', async () => {
      const conv = makeConversation({ id: 'c1', isFavorite: false })
      const updated = { ...conv, isFavorite: true, favoriteAt: Date.now() }

      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ conversation: updated })
      vi.mocked(db.getFavoriteConversationCount).mockResolvedValue(1)

      store.set(conversationsAtom, [conv])

      await store.set(toggleFavoriteAtom, 'c1')

      expect(store.get(conversationsAtom)[0]!.isFavorite).toBe(true)
    })

    it('should do nothing when response has no conversation', async () => {
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({})

      const conv = makeConversation({ id: 'c1' })
      store.set(conversationsAtom, [conv])

      await store.set(toggleFavoriteAtom, 'c1')

      // Unchanged
      expect(store.get(conversationsAtom)[0]).toEqual(conv)
    })
  })

  describe('updateTagsAtom', () => {
    it('should update tags via runtime message', async () => {
      const conv = makeConversation({ id: 'c1', tags: [] })
      const updated = { ...conv, tags: ['work'] }

      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ conversation: updated })
      vi.mocked(db.getAllTags).mockResolvedValue(['work'])

      store.set(conversationsAtom, [conv])

      await store.set(updateTagsAtom, { conversationId: 'c1', tags: ['work'] })

      expect(store.get(conversationsAtom)[0]!.tags).toEqual(['work'])
    })

    it('should return null when runtime returns no conversation', async () => {
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({})

      const result = await store.set(updateTagsAtom, { conversationId: 'c1', tags: ['work'] })

      expect(result).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(browser.runtime.sendMessage).mockRejectedValue(new Error('fail'))

      const result = await store.set(updateTagsAtom, { conversationId: 'c1', tags: ['work'] })

      expect(result).toBeNull()
    })
  })
})
