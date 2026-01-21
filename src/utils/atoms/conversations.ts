import { atom } from 'jotai'
import type { Conversation, Message, Platform, SearchFilters, SyncState } from '@/types'
import { getConversations, getMessagesByConversationId, getConversationCount } from '@/utils/db'

// ============================================================================
// Conversation List State
// ============================================================================

/**
 * Currently displayed conversation list
 */
export const conversationsAtom = atom<Conversation[]>([])

/**
 * Whether conversations are loading
 */
export const isLoadingConversationsAtom = atom(false)

/**
 * Conversation list filters
 */
export const filtersAtom = atom<SearchFilters>({
  platforms: [],
  dateRange: { start: null, end: null },
  tags: [],
})

/**
 * Search query
 */
export const searchQueryAtom = atom('')

/**
 * Pagination state
 */
export const paginationAtom = atom({
  offset: 0,
  limit: 20,
  hasMore: true,
})

// ============================================================================
// Selected Conversation State
// ============================================================================

/**
 * Currently selected conversation ID
 */
export const selectedConversationIdAtom = atom<string | null>(null)

/**
 * Currently selected conversation details
 */
export const selectedConversationAtom = atom<Conversation | null>(null)

/**
 * Message list of the currently selected conversation
 */
export const selectedMessagesAtom = atom<Message[]>([])

/**
 * Whether conversation details are loading
 */
export const isLoadingDetailAtom = atom(false)

// ============================================================================
// Sync State
// ============================================================================

/**
 * Sync state
 */
export const syncStateAtom = atom<SyncState>({
  status: 'idle',
  lastSyncAt: null,
  error: null,
  platform: null,
})

// ============================================================================
// Stats
// ============================================================================

/**
 * Conversation counts per platform
 */
export const conversationCountsAtom = atom<Record<Platform | 'total', number>>({
  claude: 0,
  chatgpt: 0,
  gemini: 0,
  total: 0,
})

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Filtered conversation list
 */
export const filteredConversationsAtom = atom((get) => {
  const conversations = get(conversationsAtom)
  const filters = get(filtersAtom)
  const query = get(searchQueryAtom).toLowerCase()

  let result = conversations

  // Platform filtering
  if (filters.platforms.length > 0) {
    result = result.filter((c) => filters.platforms.includes(c.platform))
  }

  // Date range filtering
  if (filters.dateRange.start) {
    result = result.filter((c) => c.updatedAt >= filters.dateRange.start!)
  }
  if (filters.dateRange.end) {
    result = result.filter((c) => c.updatedAt <= filters.dateRange.end!)
  }

  // Tag filtering
  if (filters.tags.length > 0) {
    result = result.filter((c) => filters.tags.some((tag) => c.tags.includes(tag)))
  }

  // Search filtering
  if (query) {
    result = result.filter(
      (c) => c.title.toLowerCase().includes(query) || c.preview.toLowerCase().includes(query)
    )
  }

  return result
})

// ============================================================================
// Action Atoms
// ============================================================================

/**
 * Load conversation list
 */
export const loadConversationsAtom = atom(null, async (get, set, options?: { reset?: boolean }) => {
  const { reset = false } = options ?? {}

  set(isLoadingConversationsAtom, true)

  try {
    const pagination = get(paginationAtom)
    const offset = reset ? 0 : pagination.offset
    const limit = pagination.limit

    const conversations = await getConversations({ limit: limit + 1, offset })

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

    // Update stats
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
  } catch (e) {
    console.error('[ChatCentral] Failed to load conversations:', e)
  } finally {
    set(isLoadingConversationsAtom, false)
  }
})

/**
 * Load conversation details
 */
export const loadConversationDetailAtom = atom(null, async (get, set, conversationId: string) => {
  set(isLoadingDetailAtom, true)
  set(selectedConversationIdAtom, conversationId)

  try {
    const conversations = get(conversationsAtom)
    const conversation = conversations.find((c) => c.id === conversationId)

    if (conversation) {
      set(selectedConversationAtom, conversation)
    }

    const messages = await getMessagesByConversationId(conversationId)
    set(selectedMessagesAtom, messages)
  } catch (e) {
    console.error('[ChatCentral] Failed to load conversation detail:', e)
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