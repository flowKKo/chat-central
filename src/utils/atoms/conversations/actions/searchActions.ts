import { atom } from 'jotai'
import { searchConversationsWithMatches } from '@/utils/db'
import { createLogger } from '@/utils/logger'
import { parseSearchQuery } from '@/utils/search-parser'
import { DEFAULT_PAGE_SIZE } from '@/utils/constants'
import {
  activeSearchQueryAtom,
  conversationsAtom,
  filtersAtom,
  isLoadingConversationsAtom,
  paginationAtom,
  searchResultsAtom,
} from '../state'
import { loadConversationsAtom } from './loadingActions'

const log = createLogger('ChatCentral')

// ============================================================================
// Search Actions
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
    // Reset pagination limit (search overrides it with results.length)
    set(paginationAtom, { offset: 0, limit: DEFAULT_PAGE_SIZE, hasMore: true })
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
  set(paginationAtom, { offset: 0, limit: DEFAULT_PAGE_SIZE, hasMore: true })
  await set(loadConversationsAtom, { reset: true })
})
