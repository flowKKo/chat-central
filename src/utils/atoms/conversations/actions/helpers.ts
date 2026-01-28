import type { Getter, Setter } from 'jotai'
import type { Conversation, Message, Platform } from '@/types'
import {
  deleteMessagesByConversationId,
  getConversationCount,
  getFavoriteConversationCount,
  getMessagesByConversationId,
  upsertMessages,
} from '@/utils/db'
import {
  conversationCountsAtom,
  conversationsAtom,
  favoriteCountsAtom,
  favoritesConversationsAtom,
  favoritesPaginationAtom,
  paginationAtom,
  selectedConversationAtom,
} from '../state'

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Reset pagination for both conversations and favorites
 */
export function resetAllPagination(get: Getter, set: Setter): void {
  set(paginationAtom, {
    offset: 0,
    limit: get(paginationAtom).limit,
    hasMore: true,
  })
  set(favoritesPaginationAtom, {
    offset: 0,
    limit: get(favoritesPaginationAtom).limit,
    hasMore: true,
  })
}

// ============================================================================
// List Update Helpers
// ============================================================================

/**
 * Apply an update to a conversation list
 */
export function applyConversationUpdate(
  list: Conversation[],
  updated: Conversation
): Conversation[] {
  return list.map((item) => (item.id === updated.id ? updated : item))
}

/**
 * Update conversation in all relevant atoms (conversations, favorites, selected)
 */
export function updateConversationInAllAtoms(
  get: Getter,
  set: Setter,
  updated: Conversation
): void {
  set(conversationsAtom, applyConversationUpdate(get(conversationsAtom), updated))
  set(favoritesConversationsAtom, applyConversationUpdate(get(favoritesConversationsAtom), updated))

  const selected = get(selectedConversationAtom)
  if (selected?.id === updated.id) {
    set(selectedConversationAtom, updated)
  }
}

// ============================================================================
// Stats Helpers
// ============================================================================

/**
 * Load and set conversation counts
 */
export async function loadConversationCounts(set: Setter): Promise<void> {
  const [claudeCount, chatgptCount, geminiCount, totalCount] = await Promise.all([
    getConversationCount('claude'),
    getConversationCount('chatgpt'),
    getConversationCount('gemini'),
    getConversationCount(),
  ])

  set(conversationCountsAtom, {
    claude: claudeCount,
    chatgpt: chatgptCount,
    gemini: geminiCount,
    total: totalCount,
  })
}

/**
 * Load and set favorite counts
 */
export async function loadFavoriteCounts(set: Setter): Promise<void> {
  const [claudeCount, chatgptCount, geminiCount, totalCount] = await Promise.all([
    getFavoriteConversationCount('claude'),
    getFavoriteConversationCount('chatgpt'),
    getFavoriteConversationCount('gemini'),
    getFavoriteConversationCount(),
  ])

  set(favoriteCountsAtom, {
    claude: claudeCount,
    chatgpt: chatgptCount,
    gemini: geminiCount,
    total: totalCount,
  })
}

// ============================================================================
// Platform Counts Type
// ============================================================================

export type PlatformCounts = Record<Platform | 'total', number>

// ============================================================================
// Message Loading Helpers
// ============================================================================

/**
 * Load messages with Gemini ID migration fallback
 *
 * Gemini IDs may have been stored with or without the 'c_' prefix in older versions.
 * This function attempts to load messages using the current ID, and if none are found
 * for Gemini conversations, tries the alternate ID format and migrates the messages.
 */
export async function loadMessagesWithFallback(conversation: Conversation): Promise<Message[]> {
  const primary = await getMessagesByConversationId(conversation.id)
  if (primary.length > 0) return primary

  if (conversation.platform !== 'gemini') return primary

  const originalId = conversation.originalId
  const altId = originalId.startsWith('c_')
    ? `gemini_${originalId.slice(2)}`
    : `gemini_c_${originalId}`

  if (altId === conversation.id) return primary

  const legacyMessages = await getMessagesByConversationId(altId)
  if (legacyMessages.length === 0) return primary

  const migrated = legacyMessages.map((msg) => ({
    ...msg,
    conversationId: conversation.id,
  }))

  await upsertMessages(migrated)
  await deleteMessagesByConversationId(altId)
  return migrated
}
