/**
 * Sync module constants
 * Consolidated constants used across export, import, and cloud-sync modules
 */

// ============================================================================
// Version Constants
// ============================================================================

/**
 * Current export format version (Markdown ZIP)
 */
export const EXPORT_VERSION = '2.0'

/**
 * Legacy v1 export format version (JSONL ZIP)
 */
export const EXPORT_VERSION_V1 = '1.0'

/**
 * Supported import versions for backward compatibility
 */
export const SUPPORTED_VERSIONS = ['1.0', '2.0'] as const

// ============================================================================
// Archive Filename Constants
// ============================================================================

/**
 * Filename for conversations JSONL in export archives
 */
export const FILENAME_CONVERSATIONS = 'conversations.jsonl'

/**
 * Filename for messages JSONL in export archives
 */
export const FILENAME_MESSAGES = 'messages.jsonl'

/**
 * Filename for manifest JSON in export archives
 */
export const FILENAME_MANIFEST = 'manifest.json'

// ============================================================================
// Cloud Sync Constants
// ============================================================================

/**
 * Storage key for cloud sync state in local storage
 */
export const CLOUD_SYNC_STORAGE_KEY = 'cloudSyncState'

/**
 * Filename for cloud sync data file
 */
export const CLOUD_SYNC_FILENAME = 'chat-central-sync.json'
