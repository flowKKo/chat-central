import { atom } from 'jotai'
import { getConversationById, getMessagesByConversationId } from '@/utils/db'
import { createLogger } from '@/utils/logger'
import {
  conversationsAtom,
  favoritesConversationsAtom,
  isLoadingDetailAtom,
  scrollToMessageIdAtom,
  selectedConversationAtom,
  selectedConversationIdAtom,
  selectedMessagesAtom,
} from '../state'
import { applyConversationUpdate, loadMessagesWithFallback } from './helpers'

const log = createLogger('ChatCentral')

// ============================================================================
// Conversation Detail Actions
// ============================================================================

/**
 * Load conversation details from the main conversation list
 */
export const loadConversationDetailAtom = atom(
  null,
  async (get, set, conversationId: string, scrollToMessageId?: string) => {
    set(isLoadingDetailAtom, true)
    set(selectedConversationIdAtom, conversationId)
    set(scrollToMessageIdAtom, scrollToMessageId ?? null)

    try {
      const conversations = get(conversationsAtom)
      let conversation = conversations.find((c) => c.id === conversationId)

      if (!conversation) {
        conversation = (await getConversationById(conversationId)) ?? undefined
      }

      if (conversation) {
        set(selectedConversationAtom, conversation)
      }

      const messages = conversation
        ? await loadMessagesWithFallback(conversation)
        : await getMessagesByConversationId(conversationId)
      set(selectedMessagesAtom, messages)
    } catch (e) {
      log.error('Failed to load conversation detail:', e)
    } finally {
      set(isLoadingDetailAtom, false)
    }
  }
)

/**
 * Load conversation details from the favorites list
 */
export const loadFavoriteDetailAtom = atom(
  null,
  async (get, set, conversationId: string, scrollToMessageId?: string) => {
    set(isLoadingDetailAtom, true)
    set(selectedConversationIdAtom, conversationId)
    set(scrollToMessageIdAtom, scrollToMessageId ?? null)

    try {
      const conversations = get(favoritesConversationsAtom)
      let conversation = conversations.find((c) => c.id === conversationId)

      if (!conversation) {
        conversation = (await getConversationById(conversationId)) ?? undefined
      }

      if (conversation) {
        set(selectedConversationAtom, conversation)
      }

      const messages = conversation
        ? await loadMessagesWithFallback(conversation)
        : await getMessagesByConversationId(conversationId)
      set(selectedMessagesAtom, messages)
    } catch (e) {
      log.error('Failed to load favorite conversation detail:', e)
    } finally {
      set(isLoadingDetailAtom, false)
    }
  }
)

/**
 * Refresh currently selected conversation detail from DB.
 * Also updates list atoms so sidebar reflects the latest data.
 */
export const refreshConversationDetailAtom = atom(null, async (get, set) => {
  const conversationId = get(selectedConversationIdAtom)
  if (!conversationId) return

  set(isLoadingDetailAtom, true)
  try {
    const conversation = (await getConversationById(conversationId)) ?? undefined
    if (conversation) {
      set(selectedConversationAtom, conversation)

      // Keep list atoms in sync
      set(conversationsAtom, applyConversationUpdate(get(conversationsAtom), conversation))
      set(
        favoritesConversationsAtom,
        applyConversationUpdate(get(favoritesConversationsAtom), conversation)
      )
    }
    const messages = conversation
      ? await loadMessagesWithFallback(conversation)
      : await getMessagesByConversationId(conversationId)
    set(selectedMessagesAtom, messages)
  } catch (e) {
    log.error('Failed to refresh conversation detail:', e)
  } finally {
    set(isLoadingDetailAtom, false)
  }
})

/**
 * Clear selection
 */
export const clearSelectionAtom = atom(null, (_get, set) => {
  set(selectedConversationIdAtom, null)
  set(selectedConversationAtom, null)
  set(selectedMessagesAtom, [])
})
