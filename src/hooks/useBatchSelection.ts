import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import {
  batchSelectedCountAtom,
  batchSelectedIdsAtom,
  clearBatchSelectionAtom,
  isBatchModeAtom,
  selectAllVisibleAtom,
  toggleBatchSelectAtom,
} from '@/utils/atoms/conversations/batch'

/**
 * Custom hook for batch selection state and actions
 *
 * Consolidates all batch selection-related atoms into a single hook
 * to reduce the number of useAtom calls in components.
 */
export function useBatchSelection() {
  const [selectedIds, setSelectedIds] = useAtom(batchSelectedIdsAtom)
  const isBatchMode = useAtomValue(isBatchModeAtom)
  const selectedCount = useAtomValue(batchSelectedCountAtom)
  const toggleSelect = useSetAtom(toggleBatchSelectAtom)
  const selectAllVisible = useSetAtom(selectAllVisibleAtom)
  const clearSelection = useSetAtom(clearBatchSelectionAtom)

  /**
   * Check if a specific conversation is selected
   */
  const isSelected = useMemo(() => (id: string) => selectedIds.has(id), [selectedIds])

  /**
   * Get array of selected IDs (useful for passing to functions)
   */
  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds])

  return {
    // State
    selectedIds,
    selectedIdsArray,
    isBatchMode,
    selectedCount,

    // Derived state
    isSelected,

    // Actions
    setSelectedIds,
    toggleSelect,
    selectAllVisible,
    clearSelection,
  }
}
