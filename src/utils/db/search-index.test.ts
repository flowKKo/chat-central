import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Conversation } from '@/types'
import { ChatCentralDB } from './schema'
import { upsertConversation, upsertConversations } from './repositories/conversations'
import {
  _resetSearchIndex,
  getOrBuildIndex,
  invalidateSearchIndex,
  removeFromSearchIndex,
  searchConversationIndex,
  updateSearchIndex,
} from './search-index'

// ============================================================================
// Test Helpers
// ============================================================================

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const id = overrides.id ?? `test_${Math.random().toString(36).slice(2)}`
  return {
    id,
    platform: 'claude',
    originalId: id.replace('claude_', ''),
    title: 'Test conversation',
    createdAt: 1000,
    updatedAt: 2000,
    messageCount: 0,
    preview: '',
    tags: [],
    syncedAt: 3000,
    detailStatus: 'none',
    detailSyncedAt: null,
    isFavorite: false,
    favoriteAt: null,
    ...overrides,
  }
}

// ============================================================================
// Setup
// ============================================================================

let db: ChatCentralDB

beforeEach(async () => {
  _resetSearchIndex()
  db = new ChatCentralDB()
  const schemaModule = await import('./schema')
  Object.defineProperty(schemaModule, 'db', {
    value: db,
    writable: true,
    configurable: true,
  })
})

afterEach(async () => {
  await db.delete()
})

// ============================================================================
// getOrBuildIndex
// ============================================================================

describe('getOrBuildIndex', () => {
  it('should build index from all non-deleted conversations', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'React hooks' }),
      makeConversation({ id: 'c2', title: 'Python basics' }),
      makeConversation({ id: 'c3', title: 'Deleted convo', deleted: true }),
    ])

    const idx = await getOrBuildIndex()
    expect(idx.documentCount).toBe(2)
  })

  it('should return same index on subsequent calls (cached)', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'Test' }))

    const idx1 = await getOrBuildIndex()
    const idx2 = await getOrBuildIndex()
    expect(idx1).toBe(idx2)
  })

  it('should rebuild after invalidation', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'Test' }))

    const idx1 = await getOrBuildIndex()
    invalidateSearchIndex()
    const idx2 = await getOrBuildIndex()
    expect(idx1).not.toBe(idx2)
  })

  it('should handle empty database', async () => {
    const idx = await getOrBuildIndex()
    expect(idx.documentCount).toBe(0)
  })
})

// ============================================================================
// searchConversationIndex
// ============================================================================

describe('searchConversationIndex', () => {
  it('should find conversations by title', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'React hooks guide' }),
      makeConversation({ id: 'c2', title: 'Python basics' }),
      makeConversation({ id: 'c3', title: 'Advanced React patterns' }),
    ])

    const results = await searchConversationIndex('React')
    expect(results.length).toBe(2)
    expect(results.map((r) => r.id).sort()).toEqual(['c1', 'c3'])
  })

  it('should find conversations by summary', async () => {
    await upsertConversation(
      makeConversation({
        id: 'c1',
        title: 'Chat session',
        summary: 'Discussion about Kubernetes deployment strategies',
      })
    )

    const results = await searchConversationIndex('Kubernetes')
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('c1')
  })

  it('should find conversations by preview', async () => {
    await upsertConversation(
      makeConversation({
        id: 'c1',
        title: 'A chat',
        preview: 'How do I configure Webpack for production?',
      })
    )

    const results = await searchConversationIndex('Webpack')
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('c1')
  })

  it('should rank title matches higher than preview matches', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'Other topic', preview: 'Mentions Docker briefly' }),
      makeConversation({ id: 'c2', title: 'Docker deployment guide', preview: 'Some preview' }),
    ])

    const results = await searchConversationIndex('Docker')
    expect(results.length).toBe(2)
    // Title match (c2) should score higher
    expect(results[0]!.id).toBe('c2')
  })

  it('should support prefix search', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'TypeScript generics explained' }))

    const results = await searchConversationIndex('Type')
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('c1')
  })

  it('should support fuzzy matching', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'JavaScript performance tuning' }))

    // "Javascrpt" is a typo for "JavaScript"
    const results = await searchConversationIndex('Javascrpt')
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('c1')
  })

  it('should return results with scores', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'React hooks guide' }))

    const results = await searchConversationIndex('React')
    expect(results.length).toBe(1)
    expect(results[0]!.score).toBeGreaterThan(0)
  })

  it('should return empty array when no matches', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'Python basics' }))

    const results = await searchConversationIndex('Haskell')
    expect(results).toHaveLength(0)
  })

  it('should return empty array for empty index', async () => {
    const results = await searchConversationIndex('anything')
    expect(results).toHaveLength(0)
  })

  it('should not return deleted conversations', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'Active React chat' }),
      makeConversation({ id: 'c2', title: 'Deleted React chat', deleted: true }),
    ])

    const results = await searchConversationIndex('React')
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('c1')
  })

  it('should use AND combiner for multi-word queries', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'React hooks guide' }),
      makeConversation({ id: 'c2', title: 'React patterns advanced' }),
      makeConversation({ id: 'c3', title: 'Vue hooks tutorial' }),
    ])

    const results = await searchConversationIndex('React hooks')
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('c1')
  })
})

// ============================================================================
// updateSearchIndex
// ============================================================================

describe('updateSearchIndex', () => {
  it('should add a new conversation to existing index', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'Initial doc' }))
    await getOrBuildIndex()

    const newConv = makeConversation({ id: 'c2', title: 'GraphQL subscriptions' })
    updateSearchIndex(newConv)

    const results = await searchConversationIndex('GraphQL')
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('c2')
  })

  it('should replace an existing conversation in the index', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'Old title about Python' }))
    await getOrBuildIndex()

    const updated = makeConversation({ id: 'c1', title: 'New title about Rust' })
    updateSearchIndex(updated)

    const pythonResults = await searchConversationIndex('Python')
    expect(pythonResults).toHaveLength(0)

    const rustResults = await searchConversationIndex('Rust')
    expect(rustResults.length).toBe(1)
    expect(rustResults[0]!.id).toBe('c1')
  })

  it('should remove from index when conversation is deleted', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'React hooks' }))
    await getOrBuildIndex()

    updateSearchIndex(makeConversation({ id: 'c1', title: 'React hooks', deleted: true }))

    const results = await searchConversationIndex('React')
    expect(results).toHaveLength(0)
  })

  it('should be a no-op when index is not built yet', () => {
    // Should not throw
    updateSearchIndex(makeConversation({ id: 'c1', title: 'Test' }))
  })

  it('should be a no-op when index is dirty', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'Test' }))
    await getOrBuildIndex()
    invalidateSearchIndex()

    // Should not throw, and won't add to index since it's dirty
    updateSearchIndex(makeConversation({ id: 'c2', title: 'New doc' }))
  })
})

// ============================================================================
// removeFromSearchIndex
// ============================================================================

describe('removeFromSearchIndex', () => {
  it('should remove a conversation from the index', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'React hooks' }))
    await getOrBuildIndex()

    removeFromSearchIndex('c1')

    const results = await searchConversationIndex('React')
    expect(results).toHaveLength(0)
  })

  it('should be safe when id does not exist', async () => {
    await getOrBuildIndex()
    // Should not throw
    removeFromSearchIndex('nonexistent')
  })

  it('should be a no-op when index is not built', () => {
    // Should not throw
    removeFromSearchIndex('c1')
  })
})

// ============================================================================
// invalidateSearchIndex
// ============================================================================

describe('invalidateSearchIndex', () => {
  it('should force rebuild on next search', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'React hooks' }))
    await getOrBuildIndex()

    // Write directly to DB, bypassing the repository (simulates bulk operation)
    await db.conversations.put(makeConversation({ id: 'c2', title: 'React patterns' }))

    // Without invalidation, the index still has 1 document
    const beforeResults = await searchConversationIndex('React')
    expect(beforeResults.length).toBe(1)

    // After invalidation, rebuild should pick up both
    invalidateSearchIndex()
    const afterResults = await searchConversationIndex('React')
    expect(afterResults.length).toBe(2)
  })
})
