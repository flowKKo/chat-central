import { atom } from 'jotai'
import { browser } from 'wxt/browser'
import type { Conversation, Message, Platform } from '@/types'
import {
  deleteMessagesByConversationId,
  getAllTags,
  getConversationCount,
  getConversations,
  getFavoriteConversationCount,
  getMessagesByConversationId,
  searchConversationsWithMatches,
  upsertMessages,
} from '@/utils/db'
import { createLogger } from '@/utils/logger'
import { parseSearchQuery } from '@/utils/search-parser'
import {
  allTagsAtom,
  filtersAtom,
  conversationsAtom,
  isLoadingConversationsAtom,
  paginationAtom,
  conversationCountsAtom,
  favoritesPaginationAtom,
  activeSearchQueryAtom,
  searchResultsAtom,
  favoritesConversationsAtom,
  isLoadingFavoritesAtom,
  favoriteCountsAtom,
  isLoadingDetailAtom,
  selectedConversationIdAtom,
  scrollToMessageIdAtom,
  selectedConversationAtom,
  selectedMessagesAtom,
} from './state'

const log = createLogger('ChatCentral')

// ============================================================================
// Filter Actions
// ============================================================================

/**
 * Load all tags from database
 */
export const loadAllTagsAtom = atom(null, async (_get, set) => {
  try {
    const tags = await getAllTags()
    set(allTagsAtom, tags)
  } catch (e) {
    log.error('Failed to load tags:', e)
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
 * Clear all filters
 */
export const clearAllFiltersAtom = atom(null, (_get, set) => {
  set(filtersAtom, {
    platforms: [],
    dateRange: { start: null, end: null },
    tags: [],
  })
})

// ============================================================================
// Conversation Loading
// ============================================================================

/**
 * Load conversation list
 */
export const loadConversationsAtom = atom(null, async (get, set, options?: { reset?: boolean }) => {
  const { reset = false } = options ?? {}

  set(isLoadingConversationsAtom, true)

  try {
    const pagination = get(paginationAtom)

    // Get filters from filters atom
    const filters = get(filtersAtom)
    const platform = filters.platforms.length === 1 ? filters.platforms[0] : undefined
    const dateRange = filters.dateRange
    const hasDateRange = dateRange.start !== null || dateRange.end !== null

    if (hasDateRange) {
      // When date range is active, load ALL matching conversations (no pagination)
      const conversations = await getConversations({ platform, dateRange })
      set(conversationsAtom, conversations)
      set(paginationAtom, {
        ...pagination,
        offset: conversations.length,
        hasMore: false,
      })
    } else {
      const offset = reset ? 0 : pagination.offset
      const limit = pagination.limit

      const conversations = await getConversations({
        limit: limit + 1,
        offset,
        platform,
        dateRange,
      })

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
    }

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
    log.error('Failed to load conversations:', e)
  } finally {
    set(isLoadingConversationsAtom, false)
  }
})

/**
 * Set date range filter and reload conversations
 */
export const setDateRangeAtom = atom(
  null,
  async (get, set, range: { start: number | null; end: number | null }) => {
    const filters = get(filtersAtom)
    set(filtersAtom, { ...filters, dateRange: range })

    // Reset pagination and reload with new date filter (same pattern as setPlatformFilterAtom)
    set(paginationAtom, {
      offset: 0,
      limit: get(paginationAtom).limit,
      hasMore: true,
    })
    set(favoritesPaginationAtom, {
      offset: 0,
      limit: get(favoritesPaginationAtom).limit,
      hasMore: true,
    })

    await set(loadConversationsAtom, { reset: true })
  }
)

/**
 * Set platform filter and reload conversations
 */
export const setPlatformFilterAtom = atom(null, async (get, set, platform: Platform | 'all') => {
  const filters = get(filtersAtom)
  const platforms = platform === 'all' ? [] : [platform]
  set(filtersAtom, { ...filters, platforms })

  // Reset pagination state for both conversations and favorites
  set(paginationAtom, {
    offset: 0,
    limit: get(paginationAtom).limit,
    hasMore: true,
  })
  set(favoritesPaginationAtom, {
    offset: 0,
    limit: get(favoritesPaginationAtom).limit,
    hasMore: true,
  })

  // Reload conversations with new filter
  await set(loadConversationsAtom, { reset: true })
})

// ============================================================================
// Search
// ============================================================================

/**
 * Perform search with advanced syntax support
 *
 * Supports operators:
 * - platform:claude / platform:chatgpt / platform:gemini
 * - tag:work (multiple allowed)
 * - before:YYYY-MM-DD
 * - after:YYYY-MM-DD
 * - is:favorite
 */
export const performSearchAtom = atom(null, async (get, set, query: string) => {
  // Parse query for operators
  const parsed = parseSearchQuery(query)

  // Apply operator filters to the filter state
  const currentFilters = get(filtersAtom)
  const newFilters = { ...currentFilters }

  // Apply platform filter from query
  if (parsed.operators.platform) {
    newFilters.platforms = [parsed.operators.platform]
  }

  // Apply tag filters from query
  if (parsed.operators.tags) {
    newFilters.tags = parsed.operators.tags
  }

  // Apply date filters from query
  if (parsed.operators.before || parsed.operators.after) {
    newFilters.dateRange = {
      start: parsed.operators.after ?? currentFilters.dateRange.start,
      end: parsed.operators.before ?? currentFilters.dateRange.end,
    }
  }

  // Only update filters if operators were used
  const hasOperators =
    parsed.operators.platform ||
    parsed.operators.tags ||
    parsed.operators.before ||
    parsed.operators.after ||
    parsed.operators.isFavorite

  if (hasOperators) {
    set(filtersAtom, newFilters)
  }

  // Handle case where only operators, no text search
  if (!parsed.freeText.trim()) {
    // Reset search state but keep filters applied
    set(activeSearchQueryAtom, '')
    set(searchResultsAtom, [])
    await set(loadConversationsAtom, { reset: true })
    return
  }

  set(isLoadingConversationsAtom, true)

  try {
    // Search using the free text part only
    let results = await searchConversationsWithMatches(parsed.freeText)

    // Filter by favorite if is:favorite operator is used
    if (parsed.operators.isFavorite) {
      results = results.filter((r) => r.conversation.isFavorite)
    }

    // Store search state (store original query for display)
    set(activeSearchQueryAtom, parsed.freeText)
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
    log.error('Failed to search:', e)
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

// ============================================================================
// Favorites
// ============================================================================

/**
 * Load favorite conversation list
 */
export const loadFavoritesAtom = atom(null, async (get, set, options?: { reset?: boolean }) => {
  const { reset = false } = options ?? {}

  set(isLoadingFavoritesAtom, true)

  try {
    const pagination = get(favoritesPaginationAtom)

    // Get filters from filters atom
    const filters = get(filtersAtom)
    const platform = filters.platforms.length === 1 ? filters.platforms[0] : undefined
    const dateRange = filters.dateRange
    const hasDateRange = dateRange.start !== null || dateRange.end !== null

    if (hasDateRange) {
      // When date range is active, load ALL matching favorites (no pagination)
      const conversations = await getConversations({
        platform,
        dateRange,
        favoritesOnly: true,
        orderBy: 'favoriteAt',
      })
      set(favoritesConversationsAtom, conversations)
      set(favoritesPaginationAtom, {
        ...pagination,
        offset: conversations.length,
        hasMore: false,
      })
    } else {
      const offset = reset ? 0 : pagination.offset
      const limit = pagination.limit

      const conversations = await getConversations({
        limit: limit + 1,
        offset,
        platform,
        dateRange,
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
    log.error('Failed to load favorite conversations:', e)
  } finally {
    set(isLoadingFavoritesAtom, false)
  }
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
      log.error('Failed to toggle favorite:', e)
    }
  }
)

// ============================================================================
// Conversation Detail
// ============================================================================

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
      log.error('Failed to load conversation detail:', e)
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
      log.error('Failed to load favorite conversation detail:', e)
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

// ============================================================================
// Conversation Updates
// ============================================================================

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

      // Update all relevant atoms
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
      log.error('Failed to update tags:', e)
      return null
    }
  }
)

// ============================================================================
// Internal Helpers
// ============================================================================

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
