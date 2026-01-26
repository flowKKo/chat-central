import { atom } from 'jotai'

// ============================================================================
// Batch Selection State
// ============================================================================

/**
 * Set of selected conversation IDs for batch operations
 */
export const batchSelectedIdsAtom = atom<Set<string>>(new Set<string>())

/**
 * Whether batch selection mode is active
 */
export const isBatchModeAtom = atom((get) => get(batchSelectedIdsAtom).size > 0)

/**
 * Number of selected conversations
 */
export const batchSelectedCountAtom = atom((get) => get(batchSelectedIdsAtom).size)

/**
 * Toggle batch selection for a single conversation
 */
export const toggleBatchSelectAtom = atom(null, (get, set, id: string) => {
  const current = get(batchSelectedIdsAtom)
  const newSet = new Set(current)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  set(batchSelectedIdsAtom, newSet)
})

/**
 * Select all conversations from a given list
 */
export const selectAllVisibleAtom = atom(null, (_get, set, ids: string[]) => {
  set(batchSelectedIdsAtom, new Set(ids))
})

/**
 * Clear all batch selections
 */
export const clearBatchSelectionAtom = atom(null, (_get, set) => {
  set(batchSelectedIdsAtom, new Set<string>())
})
