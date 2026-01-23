import type { Conversation } from '@/types'
import { useMemo } from 'react'
import {
  type ConversationFilterOptions,
  type ConversationSortOptions,
  filterAndSortConversations,
} from '@/utils/filters'

/**
 * Hook to filter and sort conversations with memoization
 */
export function useConversationFilter(
  conversations: Conversation[],
  filterOptions: ConversationFilterOptions = {},
  sortOptions: ConversationSortOptions = {}
): Conversation[] {
  return useMemo(
    () => filterAndSortConversations(conversations, filterOptions, sortOptions),
    [
      conversations,
      filterOptions.platform,
      filterOptions.favoritesOnly,
      filterOptions.searchQuery,
      sortOptions.byFavoriteTime,
    ]
  )
}
