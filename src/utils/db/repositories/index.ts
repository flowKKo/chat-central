// Conversation repository
export {
  deleteConversation,
  getAllConversationsForExport,
  getConversationById,
  getConversationByOriginalId,
  getConversationCount,
  getConversations,
  getDeletedConversations,
  getFavoriteConversationCount,
  permanentlyDeleteConversation,
  softDeleteConversation,
  updateConversationFavorite,
  upsertConversation,
  upsertConversations,
} from './conversations'

// Message repository
export {
  deleteMessagesByConversationId,
  getAllMessagesForExport,
  getExistingMessageIds,
  getMessagesByConversationId,
  getMessagesByIds,
  upsertMessages,
} from './messages'

// Sync repository
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
} from './sync'
