import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useMemo } from 'react'
import {
  activeSearchQueryAtom,
  getMatchInfoAtom,
  searchQueryAtom,
  searchResultsAtom,
} from '@/utils/atoms/conversations/state'
import { clearSearchAtom, performSearchAtom } from '@/utils/atoms/conversations/actions'

/**
 * Custom hook for conversation search state and actions
 *
 * Consolidates all search-related atoms into a single hook
 * to simplify search functionality in components.
 */
export function useConversationSearch() {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom)
  const activeQuery = useAtomValue(activeSearchQueryAtom)
  const searchResults = useAtomValue(searchResultsAtom)
  const getMatchInfo = useAtomValue(getMatchInfoAtom)

  const performSearch = useSetAtom(performSearchAtom)
  const clearSearch = useSetAtom(clearSearchAtom)

  /**
   * Whether a search is currently active
   */
  const isSearchActive = useMemo(() => activeQuery.length > 0, [activeQuery])

  /**
   * Number of search results
   */
  const resultCount = useMemo(() => searchResults.length, [searchResults])

  /**
   * Execute search with the current query
   */
  const executeSearch = useCallback(async () => {
    if (searchQuery.trim()) {
      await performSearch(searchQuery)
    }
  }, [searchQuery, performSearch])

  /**
   * Clear search and reset to default view
   */
  const resetSearch = useCallback(async () => {
    setSearchQuery('')
    await clearSearch()
  }, [setSearchQuery, clearSearch])

  return {
    // State
    searchQuery,
    activeQuery,
    searchResults,

    // Derived state
    isSearchActive,
    resultCount,

    // Functions
    getMatchInfo,

    // Actions
    setSearchQuery,
    performSearch,
    clearSearch,
    executeSearch,
    resetSearch,
  }
}

/**
 * Hook for search input only (lighter weight)
 * Useful for controlled search input components
 */
export function useSearchInput() {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom)
  const performSearch = useSetAtom(performSearchAtom)
  const clearSearch = useSetAtom(clearSearchAtom)

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query)
      if (query.trim()) {
        await performSearch(query)
      } else {
        await clearSearch()
      }
    },
    [setSearchQuery, performSearch, clearSearch]
  )

  return {
    searchQuery,
    setSearchQuery,
    handleSearch,
  }
}

/**
 * Hook for search results only (lighter weight)
 * Useful for components that only display results
 */
export function useSearchResults() {
  const activeQuery = useAtomValue(activeSearchQueryAtom)
  const searchResults = useAtomValue(searchResultsAtom)
  const getMatchInfo = useAtomValue(getMatchInfoAtom)

  const isSearchActive = useMemo(() => activeQuery.length > 0, [activeQuery])

  return {
    activeQuery,
    searchResults,
    isSearchActive,
    getMatchInfo,
  }
}
