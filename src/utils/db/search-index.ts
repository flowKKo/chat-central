import MiniSearch from 'minisearch'
import type { Conversation } from '@/types'
import { db } from './schema'
import { createLogger } from '@/utils/logger'

const log = createLogger('SearchIndex')

// ============================================================================
// Types
// ============================================================================

interface IndexedDocument {
  id: string
  title: string
  summary: string
  preview: string
  messageDigest: string
}

export interface ConversationSearchResult {
  id: string
  score: number
}

// Max characters per conversation's message digest to keep index size reasonable
const MAX_DIGEST_LENGTH = 5000

// ============================================================================
// MiniSearch Singleton
// ============================================================================

let index: MiniSearch<IndexedDocument> | null = null
let dirty = true
// Cache message digests so metadata-only updates (favorites, tags) don't lose them
const digestCache = new Map<string, string>()

function createIndex(): MiniSearch<IndexedDocument> {
  return new MiniSearch<IndexedDocument>({
    fields: ['title', 'summary', 'preview', 'messageDigest'],
    storeFields: ['id'],
    searchOptions: {
      boost: { title: 3, summary: 1.5, preview: 1, messageDigest: 0.5 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    },
  })
}

function toDocument(conv: Conversation, messageDigest = ''): IndexedDocument {
  return {
    id: conv.id,
    title: conv.title,
    summary: conv.summary ?? '',
    preview: conv.preview,
    messageDigest,
  }
}

/**
 * Build a message digest string for a conversation by concatenating message content.
 * Truncated to MAX_DIGEST_LENGTH to keep index size manageable.
 */
async function buildMessageDigest(conversationId: string): Promise<string> {
  const messages = await db.messages
    .where('conversationId')
    .equals(conversationId)
    .limit(100)
    .toArray()

  if (messages.length === 0) return ''

  let digest = ''
  for (const msg of messages) {
    if (digest.length >= MAX_DIGEST_LENGTH) break
    digest += `${msg.content} `
  }

  return digest.slice(0, MAX_DIGEST_LENGTH)
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the MiniSearch index, building it lazily on first call or after invalidation.
 */
export async function getOrBuildIndex(): Promise<MiniSearch<IndexedDocument>> {
  if (index && !dirty) {
    return index
  }

  const newIndex = createIndex()

  const conversations = await db.conversations.filter((conv) => !conv.deleted).toArray()

  // Build message digests for all conversations in parallel
  const digestResults = await Promise.allSettled(
    conversations.map((conv) => buildMessageDigest(conv.id))
  )
  const digests = digestResults.map((r) => (r.status === 'fulfilled' ? r.value : ''))

  // Populate digest cache
  digestCache.clear()
  conversations.forEach((conv, i) => {
    if (digests[i]) digestCache.set(conv.id, digests[i])
  })

  const documents = conversations.map((conv, i) => toDocument(conv, digests[i]))
  newIndex.addAll(documents)

  index = newIndex
  dirty = false
  log.debug(`Index built with ${documents.length} documents`)

  return index
}

/**
 * Incrementally add or replace a single conversation in the index.
 * Does NOT update message digest - use updateSearchIndexWithMessages for that.
 */
export function updateSearchIndex(conv: Conversation): void {
  if (!index || dirty) return

  if (index.has(conv.id)) {
    index.discard(conv.id)
  }

  if (!conv.deleted) {
    // Preserve cached messageDigest so metadata-only updates don't break message search
    const cachedDigest = digestCache.get(conv.id) ?? ''
    index.add(toDocument(conv, cachedDigest))
  } else {
    digestCache.delete(conv.id)
  }
}

/**
 * Incrementally update a conversation's search index including message digest.
 * Call this after messages are upserted for a conversation.
 */
export async function updateSearchIndexWithMessages(conversationId: string): Promise<void> {
  if (!index || dirty) return

  const conv = await db.conversations.get(conversationId)
  if (!conv || conv.deleted) return

  const digest = await buildMessageDigest(conversationId)
  digestCache.set(conversationId, digest)

  if (index.has(conv.id)) {
    index.discard(conv.id)
  }

  index.add(toDocument(conv, digest))
}

/**
 * Remove a single conversation from the index.
 */
export function removeFromSearchIndex(id: string): void {
  if (!index || dirty) return
  digestCache.delete(id)

  if (index.has(id)) {
    index.discard(id)
  }
}

/**
 * Mark the index as dirty, forcing a full rebuild on next search.
 */
export function invalidateSearchIndex(): void {
  dirty = true
  index = null
  digestCache.clear()
}

/**
 * Search conversations using MiniSearch.
 * Returns results sorted by BM25 relevance score.
 */
export async function searchConversationIndex(
  query: string,
  options?: { includeMessages?: boolean }
): Promise<ConversationSearchResult[]> {
  const idx = await getOrBuildIndex()
  const { includeMessages = true } = options ?? {}

  const results = includeMessages
    ? idx.search(query)
    : idx.search(query, {
        fields: ['title', 'summary', 'preview'],
      })

  return results.map((r) => ({
    id: r.id,
    score: r.score,
  }))
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Reset internal state. For testing only.
 */
export function _resetSearchIndex(): void {
  index = null
  dirty = true
  digestCache.clear()
}
