import { atom } from 'jotai'
import { browser } from 'wxt/browser'
import type { Conversation } from '@/types'
import { createLogger } from '@/utils/logger'
import { conversationsAtom, favoritesConversationsAtom, selectedConversationAtom } from '../state'
import { applyConversationUpdate } from './helpers'
import { loadAllTagsAtom } from './filterActions'

const log = createLogger('ChatCentral')

// ============================================================================
// Conversation Update Actions
// ============================================================================

/**
 * Update a conversation in all relevant atoms
 */
export const updateConversationAtom = atom(null, (get, set, updated: Conversation) => {
  set(conversationsAtom, applyConversationUpdate(get(conversationsAtom), updated))
  set(favoritesConversationsAtom, applyConversationUpdate(get(favoritesConversationsAtom), updated))

  const selected = get(selectedConversationAtom)
  if (selected?.id === updated.id) {
    set(selectedConversationAtom, updated)
  }
})

/**
 * Update tags for a conversation
 */
export const updateTagsAtom = atom(
  null,
  async (get, set, { conversationId, tags }: { conversationId: string; tags: string[] }) => {
    try {
      const response = (await browser.runtime.sendMessage({
        action: 'UPDATE_TAGS',
        conversationId,
        tags,
      })) as { conversation?: Conversation | null } | undefined

      const updated: Conversation | null = response?.conversation ?? null
      if (!updated) return null

      // Update all relevant atoms
      set(conversationsAtom, applyConversationUpdate(get(conversationsAtom), updated))
      set(
        favoritesConversationsAtom,
        applyConversationUpdate(get(favoritesConversationsAtom), updated)
      )

      const selected = get(selectedConversationAtom)
      if (selected?.id === updated.id) {
        set(selectedConversationAtom, updated)
      }

      // Refresh all tags cache
      await set(loadAllTagsAtom)

      return updated
    } catch (e) {
      log.error('Failed to update tags:', e)
      return null
    }
  }
)
