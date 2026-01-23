import { atom } from 'jotai'
import { browser } from 'wxt/browser'
import type { Conversation, Message, Platform, SearchFilters, SyncState } from '@/types'
import {
  deleteMessagesByConversationId,
  getAllTags,
  getConversationCount,
  getConversations,
  getFavoriteConversationCount,
  getMessagesByConversationId,
  searchConversationsWithMatches,
  type SearchResultWithMatches,
  upsertMessages,
} from '@/utils/db'

// ============================================================================
// Conversation List State
// ============================================================================

/**
 * Currently displayed conversation list
 */
export const conversationsAtom = atom<Conversation[]>([])

/**
 * Whether conversations are loading
 */
export const isLoadingConversationsAtom = atom(false)

/**
 * Favorite conversation list
 */
export const favoritesConversationsAtom = atom<Conversation[]>([])

/**
 * Whether favorite conversations are loading
 */
export const isLoadingFavoritesAtom = atom(false)

/**
 * Conversation list filters
 */
export const filtersAtom = atom<SearchFilters>({
  platforms: [],
  dateRange: { start: null, end: null },
  tags: [],
})

/**
 * All unique tags from database
 */
export const allTagsAtom = atom<string[]>([])

/**
 * Currently selected filter tags (derived from filtersAtom)
 */
export const selectedFilterTagsAtom = atom((get) => get(filtersAtom).tags)

/**
 * Load all tags from database
 */
export const loadAllTagsAtom = atom(null, async (_get, set) => {
  try {
    const tags = await getAllTags()
    set(allTagsAtom, tags)
  } catch (e) {
    console.error('[ChatCentral] Failed to load tags:', e)
  }
})

/**
 * Toggle a tag in the filter
 */
export const toggleTagFilterAtom = atom(null, (get, set, tag: string) => {
  const filters = get(filtersAtom)
  const currentTags = filters.tags
  const newTags = currentTags.includes(tag)
    ? currentTags.filter((t) => t !== tag)
    : [...currentTags, tag]
  set(filtersAtom, { ...filters, tags: newTags })
})

/**
 * Clear all tag filters
 */
export const clearTagFiltersAtom = atom(null, (get, set) => {
  const filters = get(filtersAtom)
  set(filtersAtom, { ...filters, tags: [] })
})

/**
 * Search query
 */
export const searchQueryAtom = atom('')

/**
 * Active search query (the query that was actually searched)
 */
export const activeSearchQueryAtom = atom('')

/**
 * Search results with match information
 */
export const searchResultsAtom = atom<SearchResultWithMatches[]>([])

/**
 * Get match info for a conversation by ID
 */
export const getMatchInfoAtom = atom((get) => {
  const results = get(searchResultsAtom)
  return (conversationId: string) => results.find((r) => r.conversation.id === conversationId)
})

/**
 * Pagination state
 */
export const paginationAtom = atom({
  offset: 0,
  limit: 20,
  hasMore: true,
})

/**
 * Favorites pagination state
 */
export const favoritesPaginationAtom = atom({
  offset: 0,
  limit: 20,
  hasMore: true,
})

// ============================================================================
// Selected Conversation State
// ============================================================================

/**
 * Currently selected conversation ID
 */
export const selectedConversationIdAtom = atom<string | null>(null)

/**
 * Currently selected conversation details
 */
export const selectedConversationAtom = atom<Conversation | null>(null)

/**
 * Message list of the currently selected conversation
 */
export const selectedMessagesAtom = atom<Message[]>([])

/**
 * Whether conversation details are loading
 */
export const isLoadingDetailAtom = atom(false)

/**
 * Message ID to scroll to in detail view (for search results)
 */
export const scrollToMessageIdAtom = atom<string | null>(null)

// ============================================================================
// Sync State
// ============================================================================

/**
 * Sync state
 */
export const syncStateAtom = atom<SyncState>({
  status: 'idle',
  lastSyncAt: null,
  error: null,
  platform: null,
})

// ============================================================================
// Stats
// ============================================================================

/**
 * Conversation counts per platform
 */
export const conversationCountsAtom = atom<Record<Platform | 'total', number>>({
  claude: 0,
  chatgpt: 0,
  gemini: 0,
  total: 0,
})

/**
 * Favorite conversation counts per platform
 */
export const favoriteCountsAtom = atom<Record<Platform | 'total', number>>({
  claude: 0,
  chatgpt: 0,
  gemini: 0,
  total: 0,
})

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Filtered conversation list
 */
export const filteredConversationsAtom = atom((get) => {
  const conversations = get(conversationsAtom)
  const filters = get(filtersAtom)
  const query = get(searchQueryAtom).toLowerCase()

  let result = conversations

  // Platform filtering
  if (filters.platforms.length > 0) {
    result = result.filter((c) => filters.platforms.includes(c.platform))
  }

  // Date range filtering
  if (filters.dateRange.start) {
    result = result.filter((c) => c.updatedAt >= filters.dateRange.start!)
  }
  if (filters.dateRange.end) {
    result = result.filter((c) => c.updatedAt <= filters.dateRange.end!)
  }

  // Tag filtering (OR logic - conversation must have at least one selected tag)
  // Use Set for O(1) lookup instead of O(n) includes()
  if (filters.tags.length > 0) {
    const filterTagSet = new Set(filters.tags)
    result = result.filter((c) => c.tags.some((tag) => filterTagSet.has(tag)))
  }

  // Search filtering
  if (query) {
    result = result.filter(
      (c) => c.title.toLowerCase().includes(query) || c.preview.toLowerCase().includes(query)
    )
  }

  return result
})

// ============================================================================
// Action Atoms
// ============================================================================

/**
 * Load conversation list
 */
export const loadConversationsAtom = atom(null, async (get, set, options?: { reset?: boolean }) => {
  const { reset = false } = options ?? {}

  set(isLoadingConversationsAtom, true)

  try {
    const pagination = get(paginationAtom)
    const offset = reset ? 0 : pagination.offset
    const limit = pagination.limit

    const conversations = await getConversations({ limit: limit + 1, offset })

    const hasMore = conversations.length > limit
    const data = hasMore ? conversations.slice(0, limit) : conversations

    if (reset) {
      set(conversationsAtom, data)
    } else {
      const existing = get(conversationsAtom)
      set(conversationsAtom, [...existing, ...data])
    }

    set(paginationAtom, {
      ...pagination,
      offset: offset + data.length,
      hasMore,
    })

    // Update stats
    const [claudeCount, chatgptCount, geminiCount, totalCount] = await Promise.all([
      getConversationCount('claude'),
      getConversationCount('chatgpt'),
      getConversationCount('gemini'),
      getConversationCount(),
    ])

    set(conversationCountsAtom, {
      claude: claudeCount,
      chatgpt: chatgptCount,
      gemini: geminiCount,
      total: totalCount,
    })
  } catch (e) {
    console.error('[ChatCentral] Failed to load conversations:', e)
  } finally {
    set(isLoadingConversationsAtom, false)
  }
})

/**
 * Perform search
 */
export const performSearchAtom = atom(null, async (_get, set, query: string) => {
  if (!query.trim()) {
    // Reset to normal view
    set(activeSearchQueryAtom, '')
    set(searchResultsAtom, [])
    await set(loadConversationsAtom, { reset: true })
    return
  }

  set(isLoadingConversationsAtom, true)

  try {
    const results = await searchConversationsWithMatches(query)

    // Store search state
    set(activeSearchQueryAtom, query)
    set(searchResultsAtom, results)
    set(
      conversationsAtom,
      results.map((r) => r.conversation)
    )

    // Disable pagination for search results
    set(paginationAtom, {
      offset: 0,
      limit: results.length,
      hasMore: false,
    })
  } catch (e) {
    console.error('[ChatCentral] Failed to search:', e)
  } finally {
    set(isLoadingConversationsAtom, false)
  }
})

/**
 * Clear search
 */
export const clearSearchAtom = atom(null, async (_get, set) => {
  set(activeSearchQueryAtom, '')
  set(searchResultsAtom, [])
  await set(loadConversationsAtom, { reset: true })
})

/**
 * Load favorite conversation list
 */
export const loadFavoritesAtom = atom(null, async (get, set, options?: { reset?: boolean }) => {
  const { reset = false } = options ?? {}

  set(isLoadingFavoritesAtom, true)

  try {
    const pagination = get(favoritesPaginationAtom)
    const offset = reset ? 0 : pagination.offset
    const limit = pagination.limit

    const conversations = await getConversations({
      limit: limit + 1,
      offset,
      favoritesOnly: true,
      orderBy: 'favoriteAt',
    })

    const hasMore = conversations.length > limit
    const data = hasMore ? conversations.slice(0, limit) : conversations

    if (reset) {
      set(favoritesConversationsAtom, data)
    } else {
      const existing = get(favoritesConversationsAtom)
      set(favoritesConversationsAtom, [...existing, ...data])
    }

    set(favoritesPaginationAtom, {
      ...pagination,
      offset: offset + data.length,
      hasMore,
    })

    const [claudeCount, chatgptCount, geminiCount, totalCount] = await Promise.all([
      getFavoriteConversationCount('claude'),
      getFavoriteConversationCount('chatgpt'),
      getFavoriteConversationCount('gemini'),
      getFavoriteConversationCount(),
    ])

    set(favoriteCountsAtom, {
      claude: claudeCount,
      chatgpt: chatgptCount,
      gemini: geminiCount,
      total: totalCount,
    })
  } catch (e) {
    console.error('[ChatCentral] Failed to load favorite conversations:', e)
  } finally {
    set(isLoadingFavoritesAtom, false)
  }
})

/**
 * Load conversation details
 */
export const loadConversationDetailAtom = atom(
  null,
  async (get, set, conversationId: string, scrollToMessageId?: string) => {
    set(isLoadingDetailAtom, true)
    set(selectedConversationIdAtom, conversationId)
    set(scrollToMessageIdAtom, scrollToMessageId ?? null)

    try {
      const conversations = get(conversationsAtom)
      const conversation = conversations.find((c) => c.id === conversationId)

      if (conversation) {
        set(selectedConversationAtom, conversation)
      }

      const messages = conversation
        ? await loadMessagesWithFallback(conversation)
        : await getMessagesByConversationId(conversationId)
      set(selectedMessagesAtom, messages)
    } catch (e) {
      console.error('[ChatCentral] Failed to load conversation detail:', e)
    } finally {
      set(isLoadingDetailAtom, false)
    }
  }
)

/**
 * Load favorite conversation detail
 */
export const loadFavoriteDetailAtom = atom(
  null,
  async (get, set, conversationId: string, scrollToMessageId?: string) => {
    set(isLoadingDetailAtom, true)
    set(selectedConversationIdAtom, conversationId)
    set(scrollToMessageIdAtom, scrollToMessageId ?? null)

    try {
      const conversations = get(favoritesConversationsAtom)
      const conversation = conversations.find((c) => c.id === conversationId)

      if (conversation) {
        set(selectedConversationAtom, conversation)
      }

      const messages = conversation
        ? await loadMessagesWithFallback(conversation)
        : await getMessagesByConversationId(conversationId)
      set(selectedMessagesAtom, messages)
    } catch (e) {
      console.error('[ChatCentral] Failed to load favorite conversation detail:', e)
    } finally {
      set(isLoadingDetailAtom, false)
    }
  }
)

/**
 * Clear selection
 */
export const clearSelectionAtom = atom(null, (_get, set) => {
  set(selectedConversationIdAtom, null)
  set(selectedConversationAtom, null)
  set(selectedMessagesAtom, [])
})

/**
 * Toggle favorite status
 */
export const toggleFavoriteAtom = atom(
  null,
  async (get, set, conversationId: string, value?: boolean) => {
    try {
      const response = (await browser.runtime.sendMessage({
        action: 'TOGGLE_FAVORITE',
        conversationId,
        value,
      })) as { conversation?: Conversation | null } | undefined

      const updated: Conversation | null = response?.conversation ?? null
      if (!updated) return

      const applyUpdate = (list: Conversation[]) =>
        list.map((item) => (item.id === updated.id ? updated : item))

      set(conversationsAtom, applyUpdate(get(conversationsAtom)))

      const favoriteList = get(favoritesConversationsAtom)
      if (updated.isFavorite) {
        const exists = favoriteList.some((item) => item.id === updated.id)
        if (exists) {
          set(favoritesConversationsAtom, applyUpdate(favoriteList))
        } else {
          set(favoritesConversationsAtom, [updated, ...favoriteList])
        }
      } else {
        set(
          favoritesConversationsAtom,
          favoriteList.filter((item) => item.id !== updated.id)
        )
      }

      const selected = get(selectedConversationAtom)
      if (selected?.id === updated.id) {
        set(selectedConversationAtom, updated)
      }

      const [claudeCount, chatgptCount, geminiCount, totalCount] = await Promise.all([
        getFavoriteConversationCount('claude'),
        getFavoriteConversationCount('chatgpt'),
        getFavoriteConversationCount('gemini'),
        getFavoriteConversationCount(),
      ])

      set(favoriteCountsAtom, {
        claude: claudeCount,
        chatgpt: chatgptCount,
        gemini: geminiCount,
        total: totalCount,
      })
    } catch (e) {
      console.error('[ChatCentral] Failed to toggle favorite:', e)
    }
  }
)

/**
 * Update a conversation in all relevant atoms
 */
export const updateConversationAtom = atom(null, (get, set, updated: Conversation) => {
  const applyUpdate = (list: Conversation[]) =>
    list.map((item) => (item.id === updated.id ? updated : item))

  set(conversationsAtom, applyUpdate(get(conversationsAtom)))
  set(favoritesConversationsAtom, applyUpdate(get(favoritesConversationsAtom)))

  const selected = get(selectedConversationAtom)
  if (selected?.id === updated.id) {
    set(selectedConversationAtom, updated)
  }
})

/**
 * Update tags for a conversation
 * Follows the same pattern as toggleFavoriteAtom
 */
export const updateTagsAtom = atom(
  null,
  async (get, set, { conversationId, tags }: { conversationId: string; tags: string[] }) => {
    try {
      const response = (await browser.runtime.sendMessage({
        action: 'UPDATE_TAGS',
        conversationId,
        tags,
      })) as { conversation?: Conversation | null } | undefined

      const updated: Conversation | null = response?.conversation ?? null
      if (!updated) return null

      // Update all relevant atoms (same pattern as toggleFavoriteAtom)
      const applyUpdate = (list: Conversation[]) =>
        list.map((item) => (item.id === updated.id ? updated : item))

      set(conversationsAtom, applyUpdate(get(conversationsAtom)))
      set(favoritesConversationsAtom, applyUpdate(get(favoritesConversationsAtom)))

      const selected = get(selectedConversationAtom)
      if (selected?.id === updated.id) {
        set(selectedConversationAtom, updated)
      }

      // Refresh all tags cache
      await set(loadAllTagsAtom)

      return updated
    } catch (e) {
      console.error('[ChatCentral] Failed to update tags:', e)
      return null
    }
  }
)

async function loadMessagesWithFallback(conversation: Conversation): Promise<Message[]> {
  const primary = await getMessagesByConversationId(conversation.id)
  if (primary.length > 0) return primary

  if (conversation.platform !== 'gemini') return primary

  const originalId = conversation.originalId
  const altId = originalId.startsWith('c_')
    ? `gemini_${originalId.slice(2)}`
    : `gemini_c_${originalId}`

  if (altId === conversation.id) return primary

  const legacyMessages = await getMessagesByConversationId(altId)
  if (legacyMessages.length === 0) return primary

  const migrated = legacyMessages.map((msg) => ({
    ...msg,
    conversationId: conversation.id,
  }))

  await upsertMessages(migrated)
  await deleteMessagesByConversationId(altId)
  return migrated
}
