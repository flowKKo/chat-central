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
  downloadExport,
  exportConversations,
  exportData,
  type ExportOptions,
  type ExportResult,
  exportToJson,
  type SimpleExportResult,
} from './export'

// Import utilities
export { importData, importFromJson, validateImportFile } from './import'

// Sync manager
export {
  type SyncEventListener,
  type SyncEventType,
  syncManager,
  type SyncManagerConfig,
  SyncManagerImpl,
  type SyncManagerState,
} from './manager'

// Merge utilities
export {
  conversationMergeStrategies,
  hasConflicts,
  mergeConversation,
  mergeMessage,
  mergeRecords,
  messageMergeStrategies,
} from './merge'

// Providers
export {
  createMockProvider,
  createRestProvider,
  MockSyncProvider,
  type RestProviderConfig,
  RestSyncProvider,
} from './providers'

// Types
export type {
  CloudSyncStatus,
  ConflictRecord,
  ConflictResolution,
  EntityType,
  ExportManifest,
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
