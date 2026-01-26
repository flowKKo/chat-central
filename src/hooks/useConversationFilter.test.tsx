import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useConversationFilter } from './useConversationFilter'
import type { Conversation } from '@/types'

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'test_1',
    platform: 'claude',
    originalId: '1',
    title: 'Test',
    createdAt: 1000,
    updatedAt: 2000,
    messageCount: 1,
    preview: 'Hello',
    tags: [],
    syncedAt: 1000,
    detailStatus: 'none',
    detailSyncedAt: null,
    isFavorite: false,
    favoriteAt: null,
    ...overrides,
  }
}

describe('useConversationFilter', () => {
  it('should return all conversations with no filters', () => {
    const conversations = [
      makeConversation({ id: 'c1', updatedAt: 3000 }),
      makeConversation({ id: 'c2', updatedAt: 1000 }),
    ]

    const { result } = renderHook(() => useConversationFilter(conversations))
    expect(result.current).toHaveLength(2)
  })

  it('should filter by platform', () => {
    const conversations = [
      makeConversation({ id: 'c1', platform: 'claude' }),
      makeConversation({ id: 'c2', platform: 'chatgpt' }),
      makeConversation({ id: 'c3', platform: 'claude' }),
    ]

    const { result } = renderHook(() =>
      useConversationFilter(conversations, { platform: 'claude' })
    )
    expect(result.current).toHaveLength(2)
    result.current.forEach((c) => expect(c.platform).toBe('claude'))
  })

  it('should filter favorites', () => {
    const conversations = [
      makeConversation({ id: 'c1', isFavorite: true }),
      makeConversation({ id: 'c2', isFavorite: false }),
    ]

    const { result } = renderHook(() =>
      useConversationFilter(conversations, { favoritesOnly: true })
    )
    expect(result.current).toHaveLength(1)
    expect(result.current[0]!.id).toBe('c1')
  })

  it('should return empty array for empty input', () => {
    const { result } = renderHook(() => useConversationFilter([]))
    expect(result.current).toHaveLength(0)
  })
})
