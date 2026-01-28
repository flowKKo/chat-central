/**
 * Conversation action atoms
 *
 * This file re-exports all action atoms from the modular actions/ directory.
 * The actions have been split into separate files for better maintainability:
 *
 * - filterActions.ts: Tag and filter management
 * - loadingActions.ts: Conversation list loading and pagination
 * - searchActions.ts: Search functionality with operator support
 * - favoritesActions.ts: Favorites list and toggle operations
 * - detailActions.ts: Conversation detail loading
 * - updateActions.ts: Conversation updates (tags, etc.)
 * - helpers.ts: Shared helper functions
 */

// Re-export all actions for backward compatibility
export {
  // Filter actions
  clearAllFiltersAtom,
  // Search actions
  clearSearchAtom,
  // Detail actions
  clearSelectionAtom,
  clearTagFiltersAtom,
  loadAllTagsAtom,
  loadConversationDetailAtom,
  // Loading actions
  loadConversationsAtom,
  loadFavoriteDetailAtom,
  // Favorites actions
  loadFavoritesAtom,
  performSearchAtom,
  refreshConversationDetailAtom,
  setDateRangeAtom,
  setPlatformFilterAtom,
  toggleFavoriteAtom,
  toggleTagFilterAtom,
  // Update actions
  updateConversationAtom,
  updateTagsAtom,
} from './actions/index'
