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
  // Cloud storage providers
  type CloudProviderType,
  cloudProviderTypeSchema,
  type CloudStorageProvider,
  type CloudSyncOperationStatus,
  cloudSyncOperationStatusSchema,
  type CloudSyncResult,
  type CloudSyncState,
  createEmptyCloudSyncResult,
  createGoogleDriveProvider,
  createMockProvider,
  createRestProvider,
  DEFAULT_CLOUD_SYNC_STATE,
  GoogleDriveProvider,
  MockSyncProvider,
  type RestProviderConfig,
  RestSyncProvider,
} from './providers'

// Cloud sync
export {
  connectCloudProvider,
  disconnectCloudProvider,
  getActiveProvider,
  initializeCloudSync,
  isCloudConnected,
  loadCloudSyncState,
  saveCloudSyncState,
  syncToCloud,
  updateAutoSyncSettings,
} from './cloud-sync'

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
