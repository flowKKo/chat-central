// Sync engine
export {
  applyConflictResolution,
  pullOnly,
  pushOnly,
  syncCycle,
  type SyncCycleResult,
  type SyncEngineOptions,
} from './engine'

// Export utilities
export {
  exportConversations,
  exportData,
  type ExportOptions,
  type ExportResult,
  exportToJson,
  type SimpleExportResult,
} from './export'

// Markdown serialization
export { conversationToMarkdown, type ParsedMarkdownExport, parseMarkdownExport } from './markdown'

// Import utilities
export { importData, importFromJson, validateImportFile } from './import'

// Merge utilities
export {
  conversationMergeStrategies,
  hasConflicts,
  mergeConversation,
  mergeMessage,
  mergeRecords,
  messageMergeStrategies,
} from './merge'

// Types
export type {
  CloudSyncStatus,
  ConflictRecord,
  ConflictResolution,
  EntityType,
  ExportManifest,
  ExportManifestV2,
  ExportOptionsSync,
  ExportType,
  FailedRecord,
  ImportError,
  ImportOptions,
  ImportResult,
  MergeResult,
  MergeStrategy,
  OperationLog,
  OperationType,
  ProviderConfig,
  PullResult,
  PushResult,
  SyncableConversation,
  SyncableMessage,
  SyncError,
  SyncErrorCode,
  SyncFields,
  SyncProvider,
  SyncRecord,
  SyncState,
} from './types'
