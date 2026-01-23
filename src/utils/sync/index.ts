// Types
export type {
  SyncFields,
  SyncableConversation,
  SyncableMessage,
  OperationType,
  EntityType,
  OperationLog,
  CloudSyncStatus,
  SyncState,
  ConflictResolution,
  ConflictRecord,
  MergeStrategy,
  MergeResult,
  ExportType,
  ExportManifest,
  ExportOptionsSync,
  ImportOptions,
  ImportResult,
  ImportError,
  SyncRecord,
  PullResult,
  PushResult,
  FailedRecord,
  SyncErrorCode,
  SyncError,
  ProviderConfig,
  SyncProvider,
} from './types'

// Merge utilities
export {
  mergeRecords,
  mergeConversation,
  mergeMessage,
  hasConflicts,
  conversationMergeStrategies,
  messageMergeStrategies,
} from './merge'

// Export utilities
export {
  exportData,
  exportConversations,
  exportToJson,
  downloadExport,
  type ExportResult,
  type SimpleExportResult,
} from './export'

// Import utilities
export {
  importData,
  importFromJson,
  validateImportFile,
} from './import'
