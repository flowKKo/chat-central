import { z } from 'zod'

/**
 * Platform enum
 */
export const PlatformSchema = z.enum(['claude', 'chatgpt', 'gemini'])

/**
 * Base message schema with action
 */
export const BaseMessageSchema = z.object({
  action: z.string(),
})

/**
 * Capture API response message
 */
export const CaptureApiResponseSchema = z.object({
  action: z.literal('CAPTURE_API_RESPONSE'),
  url: z.string().url(),
  data: z.unknown(),
  timestamp: z.number(),
})

/**
 * Get conversations message
 */
export const GetConversationsSchema = z.object({
  action: z.literal('GET_CONVERSATIONS'),
  platform: PlatformSchema.optional(),
  limit: z.number().positive().optional(),
  offset: z.number().nonnegative().optional(),
})

/**
 * Get messages message
 */
export const GetMessagesSchema = z.object({
  action: z.literal('GET_MESSAGES'),
  conversationId: z.string().min(1),
})

/**
 * Get stats message
 */
export const GetStatsSchema = z.object({
  action: z.literal('GET_STATS'),
})

/**
 * Search message
 */
export const SearchSchema = z.object({
  action: z.literal('SEARCH'),
  query: z.string(),
  filters: z.unknown().optional(),
})

/**
 * Toggle favorite message
 */
export const ToggleFavoriteSchema = z.object({
  action: z.literal('TOGGLE_FAVORITE'),
  conversationId: z.string().min(1),
  value: z.boolean().optional(),
})

/**
 * Update tags message
 * Tags are validated to be non-empty after trimming
 */
export const UpdateTagsSchema = z.object({
  action: z.literal('UPDATE_TAGS'),
  conversationId: z.string().min(1),
  tags: z.array(
    z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, { message: 'Tag cannot be empty' })
  ),
})

/**
 * Get all tags message
 */
export const GetAllTagsSchema = z.object({
  action: z.literal('GET_ALL_TAGS'),
})

/**
 * Batch fetch conversation details and export
 */
export const BatchFetchAndExportSchema = z.object({
  action: z.literal('BATCH_FETCH_AND_EXPORT'),
  platform: PlatformSchema,
  limit: z.number().positive().optional(),
})

/**
 * Cancel an in-progress batch fetch
 */
export const BatchFetchCancelSchema = z.object({
  action: z.literal('BATCH_FETCH_CANCEL'),
})

/**
 * Search with match details (for Spotlight)
 */
export const SearchWithMatchesSchema = z.object({
  action: z.literal('SEARCH_WITH_MATCHES'),
  query: z.string().min(1),
  limit: z.number().positive().optional(),
})

/**
 * Get recent conversations (for Spotlight default view)
 */
export const GetRecentConversationsSchema = z.object({
  action: z.literal('GET_RECENT_CONVERSATIONS'),
  limit: z.number().positive().optional(),
})

/**
 * Union of all valid message schemas
 */
export const MessageSchema = z.discriminatedUnion('action', [
  CaptureApiResponseSchema,
  GetConversationsSchema,
  GetMessagesSchema,
  GetStatsSchema,
  SearchSchema,
  ToggleFavoriteSchema,
  UpdateTagsSchema,
  GetAllTagsSchema,
  BatchFetchAndExportSchema,
  BatchFetchCancelSchema,
  SearchWithMatchesSchema,
  GetRecentConversationsSchema,
])

export type CaptureApiResponseMessage = z.infer<typeof CaptureApiResponseSchema>
export type GetConversationsMessage = z.infer<typeof GetConversationsSchema>
export type GetMessagesMessage = z.infer<typeof GetMessagesSchema>
export type GetStatsMessage = z.infer<typeof GetStatsSchema>
export type SearchMessage = z.infer<typeof SearchSchema>
export type ToggleFavoriteMessage = z.infer<typeof ToggleFavoriteSchema>
export type UpdateTagsMessage = z.infer<typeof UpdateTagsSchema>
export type GetAllTagsMessage = z.infer<typeof GetAllTagsSchema>
export type BatchFetchAndExportMessage = z.infer<typeof BatchFetchAndExportSchema>
export type BatchFetchCancelMessage = z.infer<typeof BatchFetchCancelSchema>
export type SearchWithMatchesMessage = z.infer<typeof SearchWithMatchesSchema>
export type GetRecentConversationsMessage = z.infer<typeof GetRecentConversationsSchema>
export type Message = z.infer<typeof MessageSchema>
