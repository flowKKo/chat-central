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
}

export interface ConversationSearchResult {
  id: string
  score: number
}

// ============================================================================
// MiniSearch Singleton
// ============================================================================

let index: MiniSearch<IndexedDocument> | null = null
let dirty = true

function createIndex(): MiniSearch<IndexedDocument> {
  return new MiniSearch<IndexedDocument>({
    fields: ['title', 'summary', 'preview'],
    storeFields: ['id'],
    searchOptions: {
      boost: { title: 3, summary: 1.5, preview: 1 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    },
  })
}

function toDocument(conv: Conversation): IndexedDocument {
  return {
    id: conv.id,
    title: conv.title,
    summary: conv.summary ?? '',
    preview: conv.preview,
  }
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

  const documents = conversations.map(toDocument)
  newIndex.addAll(documents)

  index = newIndex
  dirty = false
  log.debug(`Index built with ${documents.length} documents`)

  return index
}

/**
 * Incrementally add or replace a single conversation in the index.
 */
export function updateSearchIndex(conv: Conversation): void {
  if (!index || dirty) return

  const doc = toDocument(conv)

  if (index.has(conv.id)) {
    index.discard(conv.id)
  }

  if (!conv.deleted) {
    index.add(doc)
  }
}

/**
 * Remove a single conversation from the index.
 */
export function removeFromSearchIndex(id: string): void {
  if (!index || dirty) return

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
}

/**
 * Search conversations using MiniSearch.
 * Returns results sorted by BM25 relevance score.
 */
export async function searchConversationIndex(query: string): Promise<ConversationSearchResult[]> {
  const idx = await getOrBuildIndex()
  const results = idx.search(query)

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
}
