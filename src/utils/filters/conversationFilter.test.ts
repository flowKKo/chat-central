import type { Conversation } from '@/types'
import { describe, it, expect } from 'vitest'
import {
  filterConversations,
  sortConversations,
  filterAndSortConversations,
} from './conversationFilter'

const createConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'test-id',
  platform: 'claude',
  originalId: 'test-original-id',
  title: 'Test Conversation',
  preview: 'Test preview text',
  url: 'https://claude.ai/chat/test',
  createdAt: 1000,
  updatedAt: 2000,
  syncedAt: 2000,
  messageCount: 5,
  tags: [],
  isFavorite: false,
  favoriteAt: null,
  detailStatus: 'full',
  detailSyncedAt: null,
  deleted: false,
  deletedAt: null,
  dirty: false,
  ...overrides,
})

describe('filterConversations', () => {
  const conversations: Conversation[] = [
    createConversation({ id: '1', platform: 'claude', title: 'Claude Chat', isFavorite: true }),
    createConversation({ id: '2', platform: 'chatgpt', title: 'GPT Chat', isFavorite: false }),
    createConversation({ id: '3', platform: 'gemini', title: 'Gemini Chat', isFavorite: true }),
    createConversation({
      id: '4',
      platform: 'claude',
      title: 'Another Claude',
      preview: 'Hello world',
    }),
  ]

  it('returns all conversations when no filters applied', () => {
    const result = filterConversations(conversations)
    expect(result).toHaveLength(4)
  })

  it('filters by platform', () => {
    const result = filterConversations(conversations, { platform: 'claude' })
    expect(result).toHaveLength(2)
    expect(result.every((c) => c.platform === 'claude')).toBe(true)
  })

  it('filters by favorites only', () => {
    const result = filterConversations(conversations, { favoritesOnly: true })
    expect(result).toHaveLength(2)
    expect(result.every((c) => c.isFavorite)).toBe(true)
  })

  it('filters by search query in title', () => {
    const result = filterConversations(conversations, { searchQuery: 'GPT' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('2')
  })

  it('filters by search query in preview', () => {
    const result = filterConversations(conversations, { searchQuery: 'Hello' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('4')
  })

  it('combines multiple filters', () => {
    const result = filterConversations(conversations, {
      platform: 'claude',
      favoritesOnly: true,
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('1')
  })

  it('returns empty array when no matches', () => {
    const result = filterConversations(conversations, { searchQuery: 'nonexistent' })
    expect(result).toHaveLength(0)
  })
})

describe('sortConversations', () => {
  const conversations: Conversation[] = [
    createConversation({ id: '1', updatedAt: 1000, favoriteAt: 3000 }),
    createConversation({ id: '2', updatedAt: 3000, favoriteAt: 1000 }),
    createConversation({ id: '3', updatedAt: 2000, favoriteAt: 2000 }),
  ]

  it('sorts by updatedAt descending by default', () => {
    const result = sortConversations(conversations)
    expect(result.map((c) => c.id)).toEqual(['2', '3', '1'])
  })

  it('sorts by favoriteAt when byFavoriteTime is true', () => {
    const result = sortConversations(conversations, { byFavoriteTime: true })
    expect(result.map((c) => c.id)).toEqual(['1', '3', '2'])
  })

  it('uses updatedAt as secondary sort when primary is equal', () => {
    const equalFavoriteTime: Conversation[] = [
      createConversation({ id: '1', updatedAt: 1000, favoriteAt: 2000 }),
      createConversation({ id: '2', updatedAt: 3000, favoriteAt: 2000 }),
    ]
    const result = sortConversations(equalFavoriteTime, { byFavoriteTime: true })
    expect(result.map((c) => c.id)).toEqual(['2', '1'])
  })
})

describe('filterConversations - tag filtering', () => {
  const conversationsWithTags: Conversation[] = [
    createConversation({ id: '1', tags: ['work', 'important'] }),
    createConversation({ id: '2', tags: ['personal'] }),
    createConversation({ id: '3', tags: ['work'] }),
    createConversation({ id: '4', tags: [] }),
    createConversation({ id: '5', tags: ['work', 'personal', 'important'] }),
  ]

  it('returns all conversations when tags filter is empty', () => {
    const result = filterConversations(conversationsWithTags, { tags: [] })
    expect(result).toHaveLength(5)
  })

  it('filters by single tag', () => {
    const result = filterConversations(conversationsWithTags, { tags: ['work'] })
    expect(result).toHaveLength(3)
    expect(result.map((c) => c.id)).toEqual(['1', '3', '5'])
  })

  it('filters by multiple tags with AND logic', () => {
    const result = filterConversations(conversationsWithTags, { tags: ['work', 'important'] })
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(['1', '5'])
  })

  it('returns empty when no conversations match all tags', () => {
    const result = filterConversations(conversationsWithTags, { tags: ['nonexistent'] })
    expect(result).toHaveLength(0)
  })

  it('handles conversations with empty tags array', () => {
    const result = filterConversations(conversationsWithTags, { tags: ['personal'] })
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(['2', '5'])
    // id: '4' should not be included because it has no tags
  })

  it('combines tag filter with other filters', () => {
    const conversations = [
      createConversation({ id: '1', platform: 'claude', tags: ['work'], isFavorite: true }),
      createConversation({ id: '2', platform: 'chatgpt', tags: ['work'], isFavorite: false }),
      createConversation({ id: '3', platform: 'claude', tags: ['personal'], isFavorite: true }),
    ]
    const result = filterConversations(conversations, {
      platform: 'claude',
      tags: ['work'],
      favoritesOnly: true,
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('1')
  })
})

describe('filterAndSortConversations', () => {
  const conversations: Conversation[] = [
    createConversation({ id: '1', platform: 'claude', updatedAt: 1000, isFavorite: true }),
    createConversation({ id: '2', platform: 'chatgpt', updatedAt: 3000, isFavorite: false }),
    createConversation({ id: '3', platform: 'claude', updatedAt: 2000, isFavorite: true }),
  ]

  it('filters and sorts in one call', () => {
    const result = filterAndSortConversations(
      conversations,
      { platform: 'claude' },
      { byFavoriteTime: false }
    )
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(['3', '1']) // sorted by updatedAt desc
  })
})
