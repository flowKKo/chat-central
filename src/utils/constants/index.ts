/**
 * Storage Keys
 */
export const STORAGE_KEYS = {
  CONFIG: 'config',
  SYNC_STATUS: 'sync_status',
  LAST_SYNC: 'last_sync',
} as const

/**
 * Message Types
 */
export const MESSAGE_TYPES = {
  CAPTURE: 'CHAT_CENTRAL_CAPTURE',
  CAPTURE_API_RESPONSE: 'CAPTURE_API_RESPONSE',
  GET_CONVERSATIONS: 'GET_CONVERSATIONS',
  GET_MESSAGES: 'GET_MESSAGES',
  GET_STATS: 'GET_STATS',
  SEARCH: 'SEARCH',
} as const

/**
 * Default Page Size
 */
export const DEFAULT_PAGE_SIZE = 20

/**
 * Maximum Stored Conversations
 */
export const MAX_CONVERSATIONS = 10000

/**
 * Search Debounce Delay
 */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * App Version (synced with package.json)
 */
export const APP_VERSION = '0.1.0'
