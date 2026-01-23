import type { Conversation } from '@/types'
import { useMemo } from 'react'
import {
  type ConversationFilterOptions,
  type ConversationSortOptions,
  filterAndSortConversations,
} from '@/utils/filters'

const DEFAULT_FILTER_OPTIONS: ConversationFilterOptions = {}
const DEFAULT_SORT_OPTIONS: ConversationSortOptions = {}

/**
 * Hook to filter and sort conversations with memoization
 */
export function useConversationFilter(
  conversations: Conversation[],
  filterOptions: ConversationFilterOptions = DEFAULT_FILTER_OPTIONS,
  sortOptions: ConversationSortOptions = DEFAULT_SORT_OPTIONS
): Conversation[] {
  return useMemo(
    () => filterAndSortConversations(conversations, filterOptions, sortOptions),
    [conversations, filterOptions, sortOptions]
  )
}
