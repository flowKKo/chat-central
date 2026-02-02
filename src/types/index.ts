import { z } from 'zod'

// ============================================================================
// Platform Types
// ============================================================================

export const platformSchema = z.enum(['claude', 'chatgpt', 'gemini'])
export type Platform = z.infer<typeof platformSchema>

export const PLATFORM_CONFIG = {
  claude: {
    name: 'Claude',
    color: '#D97757',
    baseUrl: 'https://claude.ai',
    icon: 'claude',
  },
  chatgpt: {
    name: 'ChatGPT',
    color: '#10A37F',
    baseUrl: 'https://chatgpt.com',
    icon: 'chatgpt',
  },
  gemini: {
    name: 'Gemini',
    color: '#4285F4',
    baseUrl: 'https://gemini.google.com',
    icon: 'gemini',
  },
} as const

// ============================================================================
// Conversation Types
// ============================================================================

export const messageRoleSchema = z.enum(['user', 'assistant', 'system'])
export type MessageRole = z.infer<typeof messageRoleSchema>

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  createdAt: z.number(),
  // Keep raw data for debugging
  _raw: z.unknown().optional(),
  // Sync fields (optional for backward compatibility)
  syncVersion: z.number().optional(),
  modifiedAt: z.number().optional(),
  syncedAt: z.number().nullable().optional(),
  dirty: z.boolean().optional(),
  deleted: z.boolean().optional(),
  deletedAt: z.number().nullable().optional(),
})
export type Message = z.infer<typeof messageSchema>

export const conversationSchema = z.object({
  // Internal ID: `${platform}_${originalId}`
  id: z.string(),
  platform: platformSchema,
  // Platform original ID
  originalId: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  messageCount: z.number(),
  // First message preview
  preview: z.string(),
  // AI-generated conversation summary (Claude only for now)
  summary: z.string().optional(),
  tags: z.array(z.string()),
  // Last synced time (from platform)
  syncedAt: z.number(),
  // Detail sync status
  detailStatus: z.enum(['none', 'partial', 'full']),
  // Detail last synced time
  detailSyncedAt: z.number().nullable(),
  // Favorite status
  isFavorite: z.boolean(),
  // Favorite timestamp
  favoriteAt: z.number().nullable(),
  // Original URL
  url: z.string().optional(),
  // Sync fields (optional for backward compatibility)
  syncVersion: z.number().optional(),
  modifiedAt: z.number().optional(),
  dirty: z.boolean().optional(),
  deleted: z.boolean().optional(),
  deletedAt: z.number().nullable().optional(),
})
export type Conversation = z.infer<typeof conversationSchema>

// ============================================================================
// Sync Types
// ============================================================================

export const syncStatusSchema = z.enum(['idle', 'syncing', 'error', 'success'])
export type SyncStatus = z.infer<typeof syncStatusSchema>

export interface SyncState {
  status: SyncStatus
  lastSyncAt: number | null
  error: string | null
  platform: Platform | null
}

// ============================================================================
// Search Types
// ============================================================================

export type SearchMatchType = 'title' | 'preview' | 'message'

export interface SearchMatch {
  type: SearchMatchType
  text: string
  messageId?: string
}

export interface SearchResultItem {
  conversation: Conversation
  matches: SearchMatch[]
}

export interface SearchResult {
  conversation: Conversation
  matches: {
    field: 'title' | 'content'
    snippet: string
  }[]
  score: number
}

export interface SearchFilters {
  platforms: Platform[]
  dateRange: {
    start: number | null
    end: number | null
  }
  tags: string[]
}

// ============================================================================
// Export Types
// ============================================================================

export const exportFormatSchema = z.enum(['markdown', 'json', 'html'])
export type ExportFormat = z.infer<typeof exportFormatSchema>

export interface ExportOptions {
  format: ExportFormat
  includeMetadata: boolean
  conversationIds: string[]
}

// ============================================================================
// Config Types
// ============================================================================

export const configSchema = z.object({
  // Sync settings
  sync: z.object({
    autoSync: z.boolean(),
    syncOnStartup: z.boolean(),
  }),
  // UI settings
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    showPreview: z.boolean(),
    pageSize: z.number().min(10).max(100),
  }),
  // Storage settings
  storage: z.object({
    maxConversations: z.number().min(100).max(10000),
    autoCleanup: z.boolean(),
    cleanupDays: z.number().min(30).max(365),
  }),
  // Widget settings
  widget: z
    .object({
      enabled: z.boolean(),
    })
    .default({ enabled: true }),
})
export type Config = z.infer<typeof configSchema>

export const DEFAULT_CONFIG: Config = {
  sync: {
    autoSync: true,
    syncOnStartup: true,
  },
  ui: {
    theme: 'system',
    showPreview: true,
    pageSize: 20,
  },
  storage: {
    maxConversations: 5000,
    autoCleanup: false,
    cleanupDays: 90,
  },
  widget: {
    enabled: true,
  },
}

// ============================================================================
// Message Types (Cross-context communication)
// ============================================================================

export type BackgroundMessage =
  | { action: 'CAPTURE_CONVERSATION'; platform: Platform; endpoint: string; payload: unknown }
  | {
      action: 'UPDATE_CONVERSATION'
      platform: Platform
      conversationId: string
      messages: Message[]
    }
  | { action: 'GET_CONVERSATIONS'; filters?: SearchFilters }
  | { action: 'SEARCH'; query: string; filters?: SearchFilters }
  | { action: 'EXPORT'; options: ExportOptions }
  | { action: 'GET_SYNC_STATUS' }
  | { action: 'TRIGGER_SYNC'; platform?: Platform }
