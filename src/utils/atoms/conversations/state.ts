import { atom } from 'jotai'
import type { Conversation, Message, Platform, SearchFilters, SyncState } from '@/types'
import type { SearchResultWithMatches } from '@/utils/db'

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
 * Check if date filter is active
 */
export const hasDateFilterAtom = atom((get) => {
  const { dateRange } = get(filtersAtom)
  return dateRange.start !== null || dateRange.end !== null
})

/**
 * Get current platform filter (single or 'all')
 */
export const currentPlatformFilterAtom = atom((get): Platform | 'all' => {
  const { platforms } = get(filtersAtom)
  const firstPlatform = platforms[0]
  return platforms.length === 1 && firstPlatform ? firstPlatform : 'all'
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

/**
 * Count conversations by platform, applying an optional date range filter
 */
function countByPlatform(
  conversations: Conversation[],
  dateRange: { start: number | null; end: number | null }
): Record<Platform | 'total', number> {
  const counts: Record<Platform | 'total', number> = {
    claude: 0,
    chatgpt: 0,
    gemini: 0,
    total: 0,
  }

  for (const conv of conversations) {
    if (dateRange.start && conv.updatedAt < dateRange.start) continue
    if (dateRange.end && conv.updatedAt > dateRange.end) continue

    counts[conv.platform]++
    counts.total++
  }

  return counts
}

/**
 * Filtered conversation counts per platform (respects date filter)
 * When a date filter is active, these counts reflect the filtered results
 */
export const filteredConversationCountsAtom = atom((get) => {
  const { dateRange } = get(filtersAtom)
  if (!dateRange.start && !dateRange.end) return get(conversationCountsAtom)
  return countByPlatform(get(conversationsAtom), dateRange)
})

/**
 * Filtered favorite counts per platform (respects date filter)
 */
export const filteredFavoriteCountsAtom = atom((get) => {
  const { dateRange } = get(filtersAtom)
  if (!dateRange.start && !dateRange.end) return get(favoriteCountsAtom)
  return countByPlatform(get(favoritesConversationsAtom), dateRange)
})

// ============================================================================
