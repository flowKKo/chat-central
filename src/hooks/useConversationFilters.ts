import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import {
  allTagsAtom,
  currentPlatformFilterAtom,
  filtersAtom,
  hasDateFilterAtom,
  selectedFilterTagsAtom,
} from '@/utils/atoms/conversations/state'
import {
  clearAllFiltersAtom,
  clearTagFiltersAtom,
  loadAllTagsAtom,
  setDateRangeAtom,
  setPlatformFilterAtom,
  toggleTagFilterAtom,
} from '@/utils/atoms/conversations/actions'

/**
 * Custom hook for conversation filter state and actions
 *
 * Consolidates all filter-related atoms into a single hook
 * to simplify filter management in components.
 */
export function useConversationFilters() {
  const [filters, setFilters] = useAtom(filtersAtom)
  const allTags = useAtomValue(allTagsAtom)
  const selectedTags = useAtomValue(selectedFilterTagsAtom)
  const currentPlatform = useAtomValue(currentPlatformFilterAtom)
  const hasDateFilter = useAtomValue(hasDateFilterAtom)

  const loadTags = useSetAtom(loadAllTagsAtom)
  const toggleTag = useSetAtom(toggleTagFilterAtom)
  const clearTags = useSetAtom(clearTagFiltersAtom)
  const clearAll = useSetAtom(clearAllFiltersAtom)
  const setDateRange = useSetAtom(setDateRangeAtom)
  const setPlatform = useSetAtom(setPlatformFilterAtom)

  /**
   * Check if a specific tag is currently selected
   */
  const isTagSelected = useMemo(() => (tag: string) => selectedTags.includes(tag), [selectedTags])

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(
    () =>
      filters.platforms.length > 0 ||
      filters.tags.length > 0 ||
      filters.dateRange.start !== null ||
      filters.dateRange.end !== null,
    [filters]
  )

  /**
   * Get the current date range
   */
  const dateRange = useMemo(() => filters.dateRange, [filters.dateRange])

  return {
    // State
    filters,
    allTags,
    selectedTags,
    currentPlatform,
    dateRange,

    // Derived state
    hasDateFilter,
    hasActiveFilters,
    isTagSelected,

    // Actions
    setFilters,
    loadTags,
    toggleTag,
    clearTags,
    clearAll,
    setDateRange,
    setPlatform,
  }
}

/**
 * Hook for platform filter only (lighter weight)
 */
export function usePlatformFilter() {
  const currentPlatform = useAtomValue(currentPlatformFilterAtom)
  const setPlatform = useSetAtom(setPlatformFilterAtom)

  return {
    currentPlatform,
    setPlatform,
  }
}

/**
 * Hook for date filter only (lighter weight)
 */
export function useDateFilter() {
  const filters = useAtomValue(filtersAtom)
  const hasDateFilter = useAtomValue(hasDateFilterAtom)
  const setDateRange = useSetAtom(setDateRangeAtom)

  return {
    dateRange: filters.dateRange,
    hasDateFilter,
    setDateRange,
  }
}

/**
 * Hook for tag filter only (lighter weight)
 */
export function useTagFilter() {
  const allTags = useAtomValue(allTagsAtom)
  const selectedTags = useAtomValue(selectedFilterTagsAtom)
  const loadTags = useSetAtom(loadAllTagsAtom)
  const toggleTag = useSetAtom(toggleTagFilterAtom)
  const clearTags = useSetAtom(clearTagFiltersAtom)

  const isTagSelected = useMemo(() => (tag: string) => selectedTags.includes(tag), [selectedTags])

  return {
    allTags,
    selectedTags,
    isTagSelected,
    loadTags,
    toggleTag,
    clearTags,
  }
}
