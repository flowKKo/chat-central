import type { Conversation, Message } from '@/types'
import { db } from './schema'

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
 * Get conversation field matches for a search query.
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
 * Simple title search for conversations
 */
export async function searchConversations(query: string): Promise<Conversation[]> {
  const lowerQuery = query.toLowerCase()

  return db.conversations
    .filter((conv) => conv.title.toLowerCase().includes(lowerQuery))
    .limit(50)
    .toArray()
}

/**
 * Search conversations and messages, return just conversations
 */
export async function searchConversationsAndMessages(query: string): Promise<Conversation[]> {
  const results = await searchConversationsWithMatches(query)
  return results.map((r) => r.conversation)
}

/**
 * Search conversations and messages with match details
 */
export async function searchConversationsWithMatches(
  query: string
): Promise<SearchResultWithMatches[]> {
  const lowerQuery = query.toLowerCase()

  // 1. Find conversations with matching titles, previews, or summaries
  const titleMatchConvs = await db.conversations
    .filter((conv) => getConversationFieldMatches(conv, lowerQuery).length > 0)
    .toArray()

  // 2. Find messages with matching content
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

  // 3. Get conversations for message matches
  const messageConvIds = Array.from(messagesByConv.keys())
  const messageConvs = await db.conversations.bulkGet(messageConvIds)

  // 4. Build result map
  const resultMap = new Map<string, SearchResultWithMatches>()

  // Add title/preview/summary matches
  for (const conv of titleMatchConvs) {
    const matches = getConversationFieldMatches(conv, lowerQuery)
    resultMap.set(conv.id, { conversation: conv, matches })
  }

  // Add message matches
  for (const conv of messageConvs) {
    if (!conv) continue

    const messages = messagesByConv.get(conv.id) || []
    const existing = resultMap.get(conv.id)

    if (existing) {
      for (const msg of messages) {
        existing.matches.push({
          type: 'message',
          text: msg.content,
          messageId: msg.id,
        })
      }
    } else {
      resultMap.set(conv.id, {
        conversation: conv,
        matches: messages.map((msg) => ({
          type: 'message' as const,
          text: msg.content,
          messageId: msg.id,
        })),
      })
    }
  }

  // Sort by updatedAt desc
  return Array.from(resultMap.values()).sort(
    (a, b) => (b.conversation.updatedAt ?? 0) - (a.conversation.updatedAt ?? 0)
  )
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
