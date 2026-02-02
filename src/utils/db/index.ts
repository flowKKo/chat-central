/**
 * Database module - Re-exports all database operations
 *
 * This module provides backward compatibility by re-exporting from:
 * - schema.ts: Database class and instance
 * - repositories/*: CRUD operations
 * - search.ts: Search operations
 * - stats.ts: Statistics
 * - bulk.ts: Bulk operations
 */

// Bulk operations
export { clearAllData, clearPlatformData } from './bulk'

// Conversation operations
export {
  deleteConversation,
  getAllConversationsForExport,
  getAllTags,
  getConversationById,
  getConversationByOriginalId,
  getConversationCount,
  getConversations,
  getDeletedConversations,
  getFavoriteConversationCount,
  permanentlyDeleteConversation,
  softDeleteConversation,
  updateConversationFavorite,
  updateConversationTags,
  upsertConversation,
  upsertConversations,
} from './repositories/conversations'

// Message operations
export {
  deleteMessagesByConversationId,
  getAllMessagesForExport,
  getExistingMessageIds,
  getMessagesByConversationId,
  getMessagesByIds,
  upsertMessages,
} from './repositories/messages'

// Sync operations
export {
  // Conflicts
  addConflict,
  // Operation log
  addOperationLog,
  cleanupDeletedRecords,
  cleanupResolvedConflicts,
  cleanupSyncedOperations,
  clearDirtyFlags,
  getConflictById,
  // Dirty tracking
  getDirtyConversations,
  getDirtyMessages,
  getPendingConflicts,
  getPendingOperations,
  // Sync state
  getSyncState,
  initializeSyncState,
  markConversationDirty,
  markMessageDirty,
  markOperationsSynced,
  resolveConflict,
  updateSyncState,
} from './repositories/sync'

// Database schema and instance
export { ChatCentralDB, db } from './schema'

// Search operations
export {
  searchConversations,
  searchConversationsAndMessages,
  searchConversationsWithMatches,
  searchMessages,
  type SearchResultWithMatches,
} from './search'

// Search index
export { invalidateSearchIndex, removeFromSearchIndex, updateSearchIndex } from './search-index'

// Statistics
export { type DBStats, getDBStats } from './stats'
