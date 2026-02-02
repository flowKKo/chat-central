import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@/types'
import { ChatCentralDB } from './schema'
import { upsertConversation, upsertConversations } from './repositories/conversations'
import { upsertMessages } from './repositories/messages'
import {
  searchConversations,
  searchConversationsAndMessages,
  searchConversationsWithMatches,
  searchMessages,
} from './search'
import { _resetSearchIndex } from './search-index'

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

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg_${Math.random().toString(36).slice(2)}`,
    conversationId: 'conv_1',
    role: 'user',
    content: 'Hello world',
    createdAt: 1000,
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
// searchConversations
// ============================================================================

describe('searchConversations', () => {
  it('should find conversations by title match', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'React hooks guide' }),
      makeConversation({ id: 'c2', title: 'Python basics' }),
      makeConversation({ id: 'c3', title: 'Advanced React patterns' }),
    ])

    const results = await searchConversations('React')
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.id).sort()).toEqual(['c1', 'c3'])
  })

  it('should be case-insensitive', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'TypeScript Generics' }))

    const results = await searchConversations('typescript generics')
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('c1')
  })

  it('should return empty array when no matches', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'JavaScript basics' }))

    const results = await searchConversations('Rust')
    expect(results).toHaveLength(0)
  })

  it('should return empty array for empty database', async () => {
    const results = await searchConversations('anything')
    expect(results).toHaveLength(0)
  })
})

// ============================================================================
// searchConversationsWithMatches
// ============================================================================

describe('searchConversationsWithMatches', () => {
  it('should return title matches with correct type', async () => {
    await upsertConversation(
      makeConversation({ id: 'c1', title: 'React hooks discussion', updatedAt: 1000 })
    )

    const results = await searchConversationsWithMatches('React')
    expect(results).toHaveLength(1)
    expect(results[0]!.conversation.id).toBe('c1')
    expect(results[0]!.matches).toHaveLength(1)
    expect(results[0]!.matches[0]!.type).toBe('title')
    expect(results[0]!.matches[0]!.text).toBe('React hooks discussion')
  })

  it('should return preview matches', async () => {
    await upsertConversation(
      makeConversation({
        id: 'c1',
        title: 'Unrelated title',
        preview: 'Learning about React hooks',
        updatedAt: 1000,
      })
    )

    const results = await searchConversationsWithMatches('React')
    expect(results).toHaveLength(1)
    expect(results[0]!.matches.some((m) => m.type === 'preview')).toBe(true)
  })

  it('should return summary matches', async () => {
    await upsertConversation(
      makeConversation({
        id: 'c1',
        title: 'Some chat',
        preview: 'Some preview',
        summary: 'Discussion about Kubernetes deployment strategies',
        updatedAt: 1000,
      })
    )

    const results = await searchConversationsWithMatches('Kubernetes')
    expect(results).toHaveLength(1)
    expect(results[0]!.matches.some((m) => m.type === 'summary')).toBe(true)
    expect(results[0]!.matches[0]!.text).toBe('Discussion about Kubernetes deployment strategies')
  })

  it('should return message content matches', async () => {
    await upsertConversation(
      makeConversation({ id: 'c1', title: 'Chat', preview: 'Hello', updatedAt: 1000 })
    )
    await upsertMessages([
      makeMessage({
        id: 'm1',
        conversationId: 'c1',
        content: 'Tell me about GraphQL subscriptions',
      }),
    ])

    const results = await searchConversationsWithMatches('GraphQL')
    expect(results).toHaveLength(1)
    expect(results[0]!.conversation.id).toBe('c1')
    expect(results[0]!.matches.some((m) => m.type === 'message')).toBe(true)
    expect(results[0]!.matches[0]!.messageId).toBe('m1')
  })

  it('should combine title and message matches for the same conversation', async () => {
    await upsertConversation(
      makeConversation({ id: 'c1', title: 'Docker containers', preview: '', updatedAt: 1000 })
    )
    await upsertMessages([
      makeMessage({ id: 'm1', conversationId: 'c1', content: 'How to build Docker images' }),
    ])

    const results = await searchConversationsWithMatches('Docker')
    expect(results).toHaveLength(1)
    const matchTypes = results[0]!.matches.map((m) => m.type)
    expect(matchTypes).toContain('title')
    expect(matchTypes).toContain('message')
  })

  it('should return results from multiple conversations', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'Testing with Vitest', updatedAt: 2000 }),
      makeConversation({ id: 'c2', title: 'Vitest configuration guide', updatedAt: 1000 }),
    ])

    const results = await searchConversationsWithMatches('Vitest')
    expect(results).toHaveLength(2)
  })

  it('should sort MiniSearch results by relevance score', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'API design first', updatedAt: 1000 }),
      makeConversation({ id: 'c2', title: 'API design second', updatedAt: 3000 }),
      makeConversation({ id: 'c3', title: 'API design third', updatedAt: 2000 }),
    ])

    const results = await searchConversationsWithMatches('API')
    expect(results).toHaveLength(3)
    // All results should be present (order determined by MiniSearch relevance)
    const ids = results.map((r) => r.conversation.id).sort()
    expect(ids).toEqual(['c1', 'c2', 'c3'])
  })

  it('should sort message-only results by updatedAt descending', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'Chat one', updatedAt: 1000 }),
      makeConversation({ id: 'c2', title: 'Chat two', updatedAt: 3000 }),
    ])
    await upsertMessages([
      makeMessage({ id: 'm1', conversationId: 'c1', content: 'Discuss Elixir patterns' }),
      makeMessage({ id: 'm2', conversationId: 'c2', content: 'More Elixir examples' }),
    ])

    const results = await searchConversationsWithMatches('Elixir')
    expect(results).toHaveLength(2)
    // Message-only results sorted by updatedAt desc
    expect(results[0]!.conversation.id).toBe('c2')
    expect(results[1]!.conversation.id).toBe('c1')
  })

  it('should return empty array when nothing matches', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'JavaScript', preview: 'JS' }))

    const results = await searchConversationsWithMatches('Haskell')
    expect(results).toHaveLength(0)
  })

  it('should not duplicate conversation when matching in multiple fields', async () => {
    await upsertConversation(
      makeConversation({
        id: 'c1',
        title: 'React patterns',
        preview: 'React hooks and React context',
        summary: 'A deep dive into React',
        updatedAt: 1000,
      })
    )

    const results = await searchConversationsWithMatches('React')
    expect(results).toHaveLength(1)
    // Should have multiple match entries but only one conversation
    expect(results[0]!.matches.length).toBeGreaterThanOrEqual(2)
  })
})

// ============================================================================
// searchConversationsAndMessages
// ============================================================================

describe('searchConversationsAndMessages', () => {
  it('should return conversation objects without match details', async () => {
    await upsertConversation(
      makeConversation({ id: 'c1', title: 'Async programming', updatedAt: 1000 })
    )

    const results = await searchConversationsAndMessages('Async')
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('c1')
    expect(results[0]!.title).toBe('Async programming')
  })

  it('should include conversations found via message content', async () => {
    await upsertConversation(
      makeConversation({ id: 'c1', title: 'Unrelated', preview: 'Nothing', updatedAt: 1000 })
    )
    await upsertMessages([
      makeMessage({ id: 'm1', conversationId: 'c1', content: 'Explain monads in Haskell' }),
    ])

    const results = await searchConversationsAndMessages('monads')
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('c1')
  })
})

// ============================================================================
// MiniSearch-specific behavior
// ============================================================================

describe('miniSearch integration', () => {
  it('should support prefix search in searchConversationsWithMatches', async () => {
    await upsertConversation(
      makeConversation({ id: 'c1', title: 'TypeScript generics explained', updatedAt: 1000 })
    )

    const results = await searchConversationsWithMatches('Type')
    expect(results).toHaveLength(1)
    expect(results[0]!.conversation.id).toBe('c1')
  })

  it('should support fuzzy matching in searchConversationsWithMatches', async () => {
    await upsertConversation(
      makeConversation({ id: 'c1', title: 'JavaScript performance tuning', updatedAt: 1000 })
    )

    // "Javascrpt" is a typo
    const results = await searchConversationsWithMatches('Javascrpt')
    expect(results).toHaveLength(1)
    expect(results[0]!.conversation.id).toBe('c1')
  })

  it('should rank title matches above preview-only matches', async () => {
    await upsertConversations([
      makeConversation({
        id: 'c1',
        title: 'Unrelated topic',
        preview: 'Mentions Docker briefly',
        updatedAt: 2000,
      }),
      makeConversation({
        id: 'c2',
        title: 'Docker deployment guide',
        preview: 'Some preview',
        updatedAt: 1000,
      }),
    ])

    const results = await searchConversationsWithMatches('Docker')
    expect(results).toHaveLength(2)
    // Title match (c2) should be ranked first despite older updatedAt
    expect(results[0]!.conversation.id).toBe('c2')
  })

  it('should place MiniSearch conversation results before message-only results', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', title: 'Chat about food', updatedAt: 5000 }),
      makeConversation({ id: 'c2', title: 'Golang concurrency patterns', updatedAt: 1000 }),
    ])
    await upsertMessages([
      makeMessage({ id: 'm1', conversationId: 'c1', content: 'Golang is great for servers' }),
    ])

    const results = await searchConversationsWithMatches('Golang')
    expect(results).toHaveLength(2)
    // c2 has MiniSearch title match, should come first
    expect(results[0]!.conversation.id).toBe('c2')
    // c1 is message-only match
    expect(results[1]!.conversation.id).toBe('c1')
  })

  it('should fall back to substring for single-char queries', async () => {
    await upsertConversation(
      makeConversation({ id: 'c1', title: 'R programming language', updatedAt: 1000 })
    )

    // Single char "R" uses substring fallback
    const results = await searchConversationsWithMatches('R')
    expect(results).toHaveLength(1)
    expect(results[0]!.conversation.id).toBe('c1')
  })

  it('should support prefix search in searchConversations', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'Kubernetes cluster setup' }))

    const results = await searchConversations('Kube')
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('c1')
  })

  it('searchConversations should fall back to substring for single-char queries', async () => {
    await upsertConversation(makeConversation({ id: 'c1', title: 'X Window System' }))

    const results = await searchConversations('X')
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('c1')
  })
})

// ============================================================================
// searchMessages
// ============================================================================

describe('searchMessages', () => {
  it('should find messages by content', async () => {
    await upsertMessages([
      makeMessage({ id: 'm1', content: 'How to use useEffect in React' }),
      makeMessage({ id: 'm2', content: 'Python list comprehensions' }),
      makeMessage({ id: 'm3', content: 'React component lifecycle' }),
    ])

    const results = await searchMessages('React')
    expect(results).toHaveLength(2)
    expect(results.map((m) => m.id).sort()).toEqual(['m1', 'm3'])
  })

  it('should be case-insensitive', async () => {
    await upsertMessages([makeMessage({ id: 'm1', content: 'WEBPACK configuration' })])

    const results = await searchMessages('webpack')
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('m1')
  })

  it('should return empty array when no messages match', async () => {
    await upsertMessages([makeMessage({ id: 'm1', content: 'JavaScript basics' })])

    const results = await searchMessages('Elixir')
    expect(results).toHaveLength(0)
  })

  it('should return empty array for empty database', async () => {
    const results = await searchMessages('anything')
    expect(results).toHaveLength(0)
  })
})
