// Conversation repository
export {
  getConversations,
  getConversationById,
  getConversationByOriginalId,
  upsertConversation,
  upsertConversations,
  updateConversationFavorite,
  deleteConversation,
  getConversationCount,
  getFavoriteConversationCount,
  softDeleteConversation,
  getDeletedConversations,
  permanentlyDeleteConversation,
  getAllConversationsForExport,
} from './conversations'

// Message repository
export {
  getMessagesByConversationId,
  upsertMessages,
  deleteMessagesByConversationId,
  getExistingMessageIds,
  getMessagesByIds,
  getAllMessagesForExport,
} from './messages'

// Sync repository
export {
  // Sync state
  getSyncState,
  updateSyncState,
  initializeSyncState,
  // Operation log
  addOperationLog,
  getPendingOperations,
  markOperationsSynced,
  cleanupSyncedOperations,
  // Conflicts
  addConflict,
  getPendingConflicts,
  resolveConflict,
  getConflictById,
  cleanupResolvedConflicts,
  // Dirty tracking
  getDirtyConversations,
  getDirtyMessages,
  markConversationDirty,
  markMessageDirty,
  clearDirtyFlags,
  cleanupDeletedRecords,
} from './sync'
