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
 */
export const UpdateTagsSchema = z.object({
  action: z.literal('UPDATE_TAGS'),
  conversationId: z.string().min(1),
  tags: z.array(z.string()),
})

/**
 * Get all tags message
 */
export const GetAllTagsSchema = z.object({
  action: z.literal('GET_ALL_TAGS'),
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
])

export type CaptureApiResponseMessage = z.infer<typeof CaptureApiResponseSchema>
export type GetConversationsMessage = z.infer<typeof GetConversationsSchema>
export type GetMessagesMessage = z.infer<typeof GetMessagesSchema>
export type GetStatsMessage = z.infer<typeof GetStatsSchema>
export type SearchMessage = z.infer<typeof SearchSchema>
export type ToggleFavoriteMessage = z.infer<typeof ToggleFavoriteSchema>
export type UpdateTagsMessage = z.infer<typeof UpdateTagsSchema>
export type GetAllTagsMessage = z.infer<typeof GetAllTagsSchema>
export type Message = z.infer<typeof MessageSchema>
