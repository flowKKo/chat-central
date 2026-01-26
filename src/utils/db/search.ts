import type { Conversation, Message } from '@/types'
import { db } from './schema'

/**
 * Search result with match information
 */
export interface SearchResultWithMatches {
  conversation: Conversation
  matches: {
    type: 'title' | 'preview' | 'message'
    text: string
    messageId?: string
  }[]
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
  query: string,
): Promise<SearchResultWithMatches[]> {
  const lowerQuery = query.toLowerCase()

  // 1. Find conversations with matching titles or previews
  const titleMatchConvs = await db.conversations
    .filter(
      (conv) =>
        conv.title.toLowerCase().includes(lowerQuery)
        || conv.preview.toLowerCase().includes(lowerQuery),
    )
    .toArray()

  // 2. Find messages with matching content
  const messageMatches = await db.messages
    .filter((msg) => msg.content.toLowerCase().includes(lowerQuery))
    .limit(500)
    .toArray()

  // Group messages by conversation
  const messagesByConv = new Map<string, typeof messageMatches>()
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

  // Add title/preview matches
  for (const conv of titleMatchConvs) {
    const matches: SearchResultWithMatches['matches'] = []
    if (conv.title.toLowerCase().includes(lowerQuery)) {
      matches.push({ type: 'title', text: conv.title })
    }
    if (conv.preview.toLowerCase().includes(lowerQuery)) {
      matches.push({ type: 'preview', text: conv.preview })
    }
    resultMap.set(conv.id, { conversation: conv, matches })
  }

  // Add message matches
  for (const conv of messageConvs) {
    if (!conv) continue

    const messages = messagesByConv.get(conv.id) || []
    const existing = resultMap.get(conv.id)

    if (existing) {
      // Add message matches to existing result
      for (const msg of messages) {
        existing.matches.push({
          type: 'message',
          text: msg.content,
          messageId: msg.id,
        })
      }
    }
    else {
      // Create new result with message matches
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
    (a, b) => (b.conversation.updatedAt ?? 0) - (a.conversation.updatedAt ?? 0),
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
