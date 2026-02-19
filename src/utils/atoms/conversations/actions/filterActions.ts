import { atom } from 'jotai'
import { getAllTags } from '@/utils/db'
import { createLogger } from '@/utils/logger'
import { activeSearchQueryAtom, allTagsAtom, filtersAtom, searchResultsAtom } from '../state'
import { resetAllPagination } from './helpers'
import { loadConversationsAtom } from './loadingActions'

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
 * Resets pagination and reloads so client-side tag filtering has all data.
 */
export const toggleTagFilterAtom = atom(null, async (get, set, tag: string) => {
  const filters = get(filtersAtom)
  const currentTags = filters.tags
  const newTags = currentTags.includes(tag)
    ? currentTags.filter((t) => t !== tag)
    : [...currentTags, tag]
  set(filtersAtom, { ...filters, tags: newTags })

  resetAllPagination(get, set)
  await set(loadConversationsAtom, { reset: true })
})

/**
 * Clear all tag filters
 * Resets pagination and reloads to reflect the unfiltered data.
 */
export const clearTagFiltersAtom = atom(null, async (get, set) => {
  const filters = get(filtersAtom)
  set(filtersAtom, { ...filters, tags: [] })

  resetAllPagination(get, set)
  await set(loadConversationsAtom, { reset: true })
})

/**
 * Clear all filters
 * Resets pagination and reloads to reflect the unfiltered data.
 */
export const clearAllFiltersAtom = atom(null, async (get, set) => {
  set(filtersAtom, {
    platforms: [],
    dateRange: { start: null, end: null },
    tags: [],
  })

  // Also clear any active search so the UI fully resets
  set(activeSearchQueryAtom, '')
  set(searchResultsAtom, [])

  resetAllPagination(get, set)
  await set(loadConversationsAtom, { reset: true })
})
