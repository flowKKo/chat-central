import type { Conversation, Message } from '@/types'
import { db } from './schema'
import { searchConversationIndex } from './search-index'

/**
 * Search result with match information
 */
export interface SearchResultWithMatches {
  conversation: Conversation
  matches: {
    type: 'title' | 'preview' | 'summary' | 'message'
    text: string
    messageId?: string
  }[]
}

/**
 * Short queries (< 2 chars) don't work well with MiniSearch.
 * Fall back to substring matching for these.
 */
const MIN_MINISEARCH_QUERY_LENGTH = 2

/**
 * Get conversation field matches for a search query using substring matching.
 * Returns match descriptors for title, preview, and summary fields.
 */
function getConversationFieldMatches(
  conv: Conversation,
  lowerQuery: string
): SearchResultWithMatches['matches'] {
  const matches: SearchResultWithMatches['matches'] = []
  if (conv.title.toLowerCase().includes(lowerQuery)) {
    matches.push({ type: 'title', text: conv.title })
  }
  if (conv.preview.toLowerCase().includes(lowerQuery)) {
    matches.push({ type: 'preview', text: conv.preview })
  }
  if (conv.summary?.toLowerCase().includes(lowerQuery)) {
    matches.push({ type: 'summary', text: conv.summary })
  }
  return matches
}

/**
 * Search conversations by title using MiniSearch (with short-query fallback).
 */
export async function searchConversations(query: string): Promise<Conversation[]> {
  if (query.length < MIN_MINISEARCH_QUERY_LENGTH) {
    const lowerQuery = query.toLowerCase()
    return db.conversations
      .filter((conv) => conv.title.toLowerCase().includes(lowerQuery))
      .limit(50)
      .toArray()
  }

  const indexResults = await searchConversationIndex(query)
  if (indexResults.length === 0) return []

  const ids = indexResults.map((r) => r.id)
  const convs = await db.conversations.bulkGet(ids)

  // Preserve MiniSearch score order
  return convs.filter((c): c is Conversation => c != null).slice(0, 50)
}

/**
 * Search conversations and messages, return just conversations
 */
export async function searchConversationsAndMessages(query: string): Promise<Conversation[]> {
  const results = await searchConversationsWithMatches(query)
  return results.map((r) => r.conversation)
}

/**
 * Search conversations and messages with match details.
 *
 * For queries >= 2 chars: uses MiniSearch for conversation matching (BM25 relevance),
 * falls back to substring for short queries. Message search always uses substring.
 */
export async function searchConversationsWithMatches(
  query: string
): Promise<SearchResultWithMatches[]> {
  const lowerQuery = query.toLowerCase()
  const useMinisearch = query.length >= MIN_MINISEARCH_QUERY_LENGTH

  // 1. Find conversation matches
  const resultMap = new Map<string, SearchResultWithMatches & { _score: number }>()

  if (useMinisearch) {
    // MiniSearch BM25 search for conversations
    const indexResults = await searchConversationIndex(query)
    if (indexResults.length > 0) {
      const ids = indexResults.map((r) => r.id)
      const convs = await db.conversations.bulkGet(ids)

      // Build score lookup
      const scoreMap = new Map(indexResults.map((r) => [r.id, r.score]))

      for (const conv of convs) {
        if (!conv) continue
        // Get substring matches for match type details
        const matches = getConversationFieldMatches(conv, lowerQuery)
        // If MiniSearch matched but substring didn't (fuzzy/prefix), add title as match
        if (matches.length === 0) {
          matches.push({ type: 'title', text: conv.title })
        }
        resultMap.set(conv.id, {
          conversation: conv,
          matches,
          _score: scoreMap.get(conv.id) ?? 0,
        })
      }
    }
  } else {
    // Short query fallback: substring matching
    const titleMatchConvs = await db.conversations
      .filter((conv) => getConversationFieldMatches(conv, lowerQuery).length > 0)
      .toArray()

    for (const conv of titleMatchConvs) {
      const matches = getConversationFieldMatches(conv, lowerQuery)
      resultMap.set(conv.id, { conversation: conv, matches, _score: 0 })
    }
  }

  // 2. Find messages with matching content (always substring)
  const messageMatches = await db.messages
    .filter((msg) => msg.content.toLowerCase().includes(lowerQuery))
    .limit(500)
    .toArray()

  // Group messages by conversation
  const messagesByConv = new Map<string, Message[]>()
  for (const msg of messageMatches) {
    const existing = messagesByConv.get(msg.conversationId) || []
    existing.push(msg)
    messagesByConv.set(msg.conversationId, existing)
  }

  // 3. Get conversations for message-only matches
  const messageOnlyConvIds = Array.from(messagesByConv.keys()).filter((id) => !resultMap.has(id))
  const messageConvs = await db.conversations.bulkGet(messageOnlyConvIds)

  // 4. Merge message matches into results
  for (const [convId, messages] of messagesByConv) {
    const existing = resultMap.get(convId)
    if (existing) {
      for (const msg of messages) {
        existing.matches.push({
          type: 'message',
          text: msg.content,
          messageId: msg.id,
        })
      }
    }
  }

  // Add message-only conversations
  for (const conv of messageConvs) {
    if (!conv) continue
    const messages = messagesByConv.get(conv.id) || []
    resultMap.set(conv.id, {
      conversation: conv,
      matches: messages.map((msg) => ({
        type: 'message' as const,
        text: msg.content,
        messageId: msg.id,
      })),
      _score: 0,
    })
  }

  // 5. Sort: MiniSearch results by score first, then message-only by updatedAt
  const results = Array.from(resultMap.values())
  results.sort((a, b) => {
    // Both have MiniSearch scores: sort by score
    if (a._score > 0 && b._score > 0) return b._score - a._score
    // One has score, one doesn't: scored first
    if (a._score > 0) return -1
    if (b._score > 0) return 1
    // Both message-only: sort by updatedAt
    return (b.conversation.updatedAt ?? 0) - (a.conversation.updatedAt ?? 0)
  })

  // Strip internal _score field
  return results.map(({ _score: _, ...rest }) => rest)
}

/**
 * Search messages directly
 */
export async function searchMessages(query: string): Promise<Message[]> {
  const lowerQuery = query.toLowerCase()

  return db.messages
    .filter((msg) => msg.content.toLowerCase().includes(lowerQuery))
    .limit(100)
    .toArray()
}
