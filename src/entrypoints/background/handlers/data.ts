import {
  GetConversationsSchema,
  GetMessagesSchema,
  SearchSchema,
  ToggleFavoriteSchema,
  UpdateTagsSchema,
} from '../schemas'
import type { Conversation, Message } from '@/types'
import {
  getAllTags,
  getConversations,
  getMessagesByConversationId,
  getDBStats,
  getConversationById,
  updateConversationFavorite,
  updateConversationTags,
} from '@/utils/db'
import { createLogger } from '@/utils/logger'

const log = createLogger('ChatCentral')

/**
 * Get conversation list
 */
export async function handleGetConversations(
  rawMessage: unknown
): Promise<{ conversations: Conversation[] } | { error: string }> {
  const parseResult = GetConversationsSchema.safeParse(rawMessage)
  if (!parseResult.success) {
    log.warn('Invalid get conversations message:', parseResult.error.message)
    return { error: 'Invalid message format' }
  }

  const { platform, limit, offset } = parseResult.data
  const conversations = await getConversations({ platform, limit, offset })
  return { conversations }
}

/**
 * Get conversation messages
 */
export async function handleGetMessages(
  rawMessage: unknown
): Promise<{ messages: Message[] } | { error: string }> {
  const parseResult = GetMessagesSchema.safeParse(rawMessage)
  if (!parseResult.success) {
    log.warn('Invalid get messages request:', parseResult.error.message)
    return { error: 'Invalid message format' }
  }

  const { conversationId } = parseResult.data
  const messages = await getMessagesByConversationId(conversationId)
  return { messages }
}

/**
 * Get statistics
 */
export async function handleGetStats() {
  const stats = await getDBStats()
  return { stats }
}

/**
 * Search conversations
 */
export async function handleSearch(
  rawMessage: unknown
): Promise<{ results: Conversation[] } | { error: string }> {
  const parseResult = SearchSchema.safeParse(rawMessage)
  if (!parseResult.success) {
    log.warn('Invalid search message:', parseResult.error.message)
    return { error: 'Invalid message format' }
  }

  // Simple implementation, can use MiniSearch for enhancement later
  const { query } = parseResult.data
  const conversations = await getConversations({ limit: 100 })

  const lowerQuery = query.toLowerCase()
  const results = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(lowerQuery) || c.preview.toLowerCase().includes(lowerQuery)
  )

  return { results }
}

/**
 * Toggle favorite status
 */
export async function handleToggleFavorite(
  rawMessage: unknown
): Promise<{ success: boolean; conversation?: Conversation | null; error?: string }> {
  const parseResult = ToggleFavoriteSchema.safeParse(rawMessage)
  if (!parseResult.success) {
    log.warn('Invalid toggle favorite message:', parseResult.error.message)
    return { success: false, error: 'Invalid message format' }
  }

  const { conversationId, value } = parseResult.data
  const existing = await getConversationById(conversationId)
  if (!existing) return { success: false, conversation: null }

  const next = typeof value === 'boolean' ? value : !existing.isFavorite
  const updated = await updateConversationFavorite(conversationId, next)
  return { success: !!updated, conversation: updated }
}

/**
 * Update conversation tags
 */
export async function handleUpdateTags(
  rawMessage: unknown
): Promise<{ success: boolean; conversation?: Conversation | null; error?: string }> {
  const parseResult = UpdateTagsSchema.safeParse(rawMessage)
  if (!parseResult.success) {
    log.warn('Invalid update tags message:', parseResult.error.message)
    return { success: false, error: 'Invalid message format' }
  }

  const { conversationId, tags } = parseResult.data
  const updated = await updateConversationTags(conversationId, tags)
  return { success: !!updated, conversation: updated }
}

/**
 * Get all unique tags
 */
export async function handleGetAllTags(): Promise<{ tags: string[] }> {
  const tags = await getAllTags()
  return { tags }
}
