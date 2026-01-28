import { atom } from 'jotai'
import { browser } from 'wxt/browser'
import type { Conversation } from '@/types'
import { getConversations } from '@/utils/db'
import { createLogger } from '@/utils/logger'
import {
  conversationsAtom,
  favoritesConversationsAtom,
  favoritesPaginationAtom,
  filtersAtom,
  isLoadingFavoritesAtom,
  selectedConversationAtom,
} from '../state'
import { applyConversationUpdate, loadFavoriteCounts } from './helpers'

const log = createLogger('ChatCentral')

// ============================================================================
// Favorites Actions
// ============================================================================

/**
 * Load favorite conversation list
 */
export const loadFavoritesAtom = atom(null, async (get, set, options?: { reset?: boolean }) => {
  const { reset = false } = options ?? {}

  set(isLoadingFavoritesAtom, true)

  try {
    const pagination = get(favoritesPaginationAtom)

    // Get filters from filters atom
    const filters = get(filtersAtom)
    const platform = filters.platforms.length === 1 ? filters.platforms[0] : undefined
    const dateRange = filters.dateRange
    const hasDateRange = dateRange.start !== null || dateRange.end !== null

    if (hasDateRange) {
      // When date range is active, load ALL matching favorites (no pagination)
      const conversations = await getConversations({
        platform,
        dateRange,
        favoritesOnly: true,
        orderBy: 'favoriteAt',
      })
      set(favoritesConversationsAtom, conversations)
      set(favoritesPaginationAtom, {
        ...pagination,
        offset: conversations.length,
        hasMore: false,
      })
    } else {
      const offset = reset ? 0 : pagination.offset
      const limit = pagination.limit

      const conversations = await getConversations({
        limit: limit + 1,
        offset,
        platform,
        dateRange,
        favoritesOnly: true,
        orderBy: 'favoriteAt',
      })

      const hasMore = conversations.length > limit
      const data = hasMore ? conversations.slice(0, limit) : conversations

      if (reset) {
        set(favoritesConversationsAtom, data)
      } else {
        const existing = get(favoritesConversationsAtom)
        set(favoritesConversationsAtom, [...existing, ...data])
      }

      set(favoritesPaginationAtom, {
        ...pagination,
        offset: offset + data.length,
        hasMore,
      })
    }

    await loadFavoriteCounts(set)
  } catch (e) {
    log.error('Failed to load favorite conversations:', e)
  } finally {
    set(isLoadingFavoritesAtom, false)
  }
})

/**
 * Toggle favorite status
 */
export const toggleFavoriteAtom = atom(
  null,
  async (get, set, conversationId: string, value?: boolean) => {
    try {
      const response = (await browser.runtime.sendMessage({
        action: 'TOGGLE_FAVORITE',
        conversationId,
        value,
      })) as { conversation?: Conversation | null } | undefined

      const updated: Conversation | null = response?.conversation ?? null
      if (!updated) return

      set(conversationsAtom, applyConversationUpdate(get(conversationsAtom), updated))

      const favoriteList = get(favoritesConversationsAtom)
      if (updated.isFavorite) {
        const exists = favoriteList.some((item) => item.id === updated.id)
        if (exists) {
          set(favoritesConversationsAtom, applyConversationUpdate(favoriteList, updated))
        } else {
          set(favoritesConversationsAtom, [updated, ...favoriteList])
        }
      } else {
        set(
          favoritesConversationsAtom,
          favoriteList.filter((item) => item.id !== updated.id)
        )
      }

      const selected = get(selectedConversationAtom)
      if (selected?.id === updated.id) {
        set(selectedConversationAtom, updated)
      }

      await loadFavoriteCounts(set)
    } catch (e) {
      log.error('Failed to toggle favorite:', e)
    }
  }
)
