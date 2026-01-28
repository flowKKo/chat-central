import { atom } from 'jotai'
import type { Platform } from '@/types'
import { getConversations } from '@/utils/db'
import { createLogger } from '@/utils/logger'
import {
  conversationsAtom,
  filtersAtom,
  isLoadingConversationsAtom,
  paginationAtom,
} from '../state'
import { loadConversationCounts, resetAllPagination } from './helpers'

const log = createLogger('ChatCentral')

// ============================================================================
// Conversation Loading
// ============================================================================

/**
 * Load conversation list
 */
export const loadConversationsAtom = atom(null, async (get, set, options?: { reset?: boolean }) => {
  const { reset = false } = options ?? {}

  set(isLoadingConversationsAtom, true)

  try {
    const pagination = get(paginationAtom)

    // Get filters from filters atom
    const filters = get(filtersAtom)
    const platform = filters.platforms.length === 1 ? filters.platforms[0] : undefined
    const dateRange = filters.dateRange
    const hasDateRange = dateRange.start !== null || dateRange.end !== null

    if (hasDateRange) {
      // When date range is active, load ALL matching conversations (no pagination)
      const conversations = await getConversations({ platform, dateRange })
      set(conversationsAtom, conversations)
      set(paginationAtom, {
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
      })

      const hasMore = conversations.length > limit
      const data = hasMore ? conversations.slice(0, limit) : conversations

      if (reset) {
        set(conversationsAtom, data)
      } else {
        const existing = get(conversationsAtom)
        set(conversationsAtom, [...existing, ...data])
      }

      set(paginationAtom, {
        ...pagination,
        offset: offset + data.length,
        hasMore,
      })
    }

    // Update stats
    await loadConversationCounts(set)
  } catch (e) {
    log.error('Failed to load conversations:', e)
  } finally {
    set(isLoadingConversationsAtom, false)
  }
})

/**
 * Set date range filter and reload conversations
 */
export const setDateRangeAtom = atom(
  null,
  async (get, set, range: { start: number | null; end: number | null }) => {
    const filters = get(filtersAtom)
    set(filtersAtom, { ...filters, dateRange: range })

    // Reset pagination and reload with new date filter
    resetAllPagination(get, set)

    await set(loadConversationsAtom, { reset: true })
  }
)

/**
 * Set platform filter and reload conversations
 */
export const setPlatformFilterAtom = atom(null, async (get, set, platform: Platform | 'all') => {
  const filters = get(filtersAtom)
  const platforms = platform === 'all' ? [] : [platform]
  set(filtersAtom, { ...filters, platforms })

  // Reset pagination state for both conversations and favorites
  resetAllPagination(get, set)

  // Reload conversations with new filter
  await set(loadConversationsAtom, { reset: true })
})
