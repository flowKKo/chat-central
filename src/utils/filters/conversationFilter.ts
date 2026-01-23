import type { Conversation, Platform } from '@/types'

/**
 * Date range filter
 */
export interface DateRangeFilter {
  start: number | null
  end: number | null
}

/**
 * Filter options for conversations
 */
export interface ConversationFilterOptions {
  platform?: Platform | 'all'
  favoritesOnly?: boolean
  searchQuery?: string
  tags?: string[]
  dateRange?: DateRangeFilter
}

/**
 * Sort options for conversations
 */
export interface ConversationSortOptions {
  /** Sort by favorites first (using favoriteAt) vs by update time */
  byFavoriteTime?: boolean
}

/**
 * Filter conversations based on platform, favorites, search query, and tags
 */
export function filterConversations(
  conversations: Conversation[],
  options: ConversationFilterOptions = {}
): Conversation[] {
  const { platform = 'all', favoritesOnly = false, searchQuery, tags = [], dateRange } = options

  return conversations.filter((conv) => {
    // Platform filter
    if (platform !== 'all' && conv.platform !== platform) {
      return false
    }

    // Favorites filter
    if (favoritesOnly && !conv.isFavorite) {
      return false
    }

    // Date range filter
    if (dateRange) {
      if (dateRange.start !== null && conv.updatedAt < dateRange.start) {
        return false
      }
      if (dateRange.end !== null && conv.updatedAt > dateRange.end) {
        return false
      }
    }

    // Tags filter (AND logic - conversation must have all selected tags)
    // Use Set for O(1) lookup instead of O(n) includes()
    if (tags.length > 0) {
      const convTagSet = new Set(conv.tags)
      const hasAllTags = tags.every((tag) => convTagSet.has(tag))
      if (!hasAllTags) {
        return false
      }
    }

    // Search filter (title and preview only - full message search is done via atoms)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = conv.title.toLowerCase().includes(query)
      const matchesPreview = conv.preview.toLowerCase().includes(query)
      if (!matchesTitle && !matchesPreview) {
        return false
      }
    }

    return true
  })
}

/**
 * Sort conversations by update time or favorite time
 */
export function sortConversations(
  conversations: Conversation[],
  options: ConversationSortOptions = {}
): Conversation[] {
  const { byFavoriteTime = false } = options

  return [...conversations].sort((a, b) => {
    // Primary sort key
    const primaryA = byFavoriteTime ? (a.favoriteAt ?? 0) : (a.updatedAt ?? 0)
    const primaryB = byFavoriteTime ? (b.favoriteAt ?? 0) : (b.updatedAt ?? 0)

    if (primaryA !== primaryB) {
      return primaryB - primaryA
    }

    // Secondary sort by update time
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  })
}

/**
 * Filter and sort conversations in one call
 */
export function filterAndSortConversations(
  conversations: Conversation[],
  filterOptions: ConversationFilterOptions = {},
  sortOptions: ConversationSortOptions = {}
): Conversation[] {
  const filtered = filterConversations(conversations, filterOptions)
  return sortConversations(filtered, sortOptions)
}
