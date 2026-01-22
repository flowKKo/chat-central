import { atom } from 'jotai'
import { browser } from 'wxt/browser'
import type { Conversation, Message, Platform, SearchFilters, SyncState } from '@/types'
import {
  getConversations,
  getMessagesByConversationId,
  getConversationCount,
  getFavoriteConversationCount,
  upsertMessages,
  deleteMessagesByConversationId,
  searchConversationsAndMessages,
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
 * Search query
 */
export const searchQueryAtom = atom('')

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

  // Tag filtering
  if (filters.tags.length > 0) {
    result = result.filter((c) => filters.tags.some((tag) => c.tags.includes(tag)))
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
    await set(loadConversationsAtom, { reset: true })
    return
  }

  set(isLoadingConversationsAtom, true)

  try {
    const results = await searchConversationsAndMessages(query)
    
    set(conversationsAtom, results)
    
    // Disable pagination for search results for now
    set(paginationAtom, {
      offset: 0,
      limit: results.length,
      hasMore: false,
    })

    // Update total count in stats to reflect search result count (optional, but helps UI)
    // Actually, keeping the original counts is probably better for context, 
    // but the UI might show "Showing X of Y". 
    // For now, let's leave the global counts alone as they represent the DB state.

  } catch (e) {
    console.error('[ChatCentral] Failed to search:', e)
  } finally {
    set(isLoadingConversationsAtom, false)
  }
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
export const loadConversationDetailAtom = atom(null, async (get, set, conversationId: string) => {
  set(isLoadingDetailAtom, true)
  set(selectedConversationIdAtom, conversationId)

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
})

/**
 * Load favorite conversation detail
 */
export const loadFavoriteDetailAtom = atom(null, async (get, set, conversationId: string) => {
  set(isLoadingDetailAtom, true)
  set(selectedConversationIdAtom, conversationId)

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
})

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
      const response = await browser.runtime.sendMessage({
        action: 'TOGGLE_FAVORITE',
        conversationId,
        value,
      })

      const updated: Conversation | null = (response as any)?.conversation ?? null
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
