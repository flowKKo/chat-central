import { describe, it, expect } from 'vitest'
import {
  mergeRecords,
  mergeConversation,
  mergeMessage,
  conversationMergeStrategies,
  messageMergeStrategies,
} from './merge'
import type { Conversation, Message } from '@/types'

describe('mergeRecords', () => {
  it('returns local value when values are equal', () => {
    const local = { id: '1', title: 'Test', modifiedAt: 1000 }
    const remote = { id: '1', title: 'Test', modifiedAt: 2000 }
    const strategies = { title: 'lww' as const }

    const result = mergeRecords(local, remote, strategies)

    expect(result.merged.title).toBe('Test')
    expect(result.conflicts).toHaveLength(0)
  })

  it('uses LWW strategy correctly', () => {
    const local = { id: '1', title: 'Local Title', modifiedAt: 2000 }
    const remote = { id: '1', title: 'Remote Title', modifiedAt: 1000 }
    const strategies = { title: 'lww' as const }

    const result = mergeRecords(local, remote, strategies)

    expect(result.merged.title).toBe('Local Title') // Local is newer
    expect(result.conflicts).toHaveLength(0)
  })

  it('uses OR strategy for boolean fields', () => {
    const local = { id: '1', isFavorite: true, modifiedAt: 1000 }
    const remote = { id: '1', isFavorite: false, modifiedAt: 2000 }
    const strategies = { isFavorite: 'or' as const }

    const result = mergeRecords(local, remote, strategies)

    expect(result.merged.isFavorite).toBe(true) // Any true = true
  })

  it('uses AND strategy for delete flags', () => {
    const local = { id: '1', deleted: true, modifiedAt: 1000 }
    const remote = { id: '1', deleted: false, modifiedAt: 2000 }
    const strategies = { deleted: 'and' as const }

    const result = mergeRecords(local, remote, strategies)

    expect(result.merged.deleted).toBe(false) // Both must be true
  })

  it('uses UNION strategy for arrays', () => {
    const local = { id: '1', tags: ['a', 'b'], modifiedAt: 1000 }
    const remote = { id: '1', tags: ['b', 'c'], modifiedAt: 2000 }
    const strategies = { tags: 'union' as const }

    const result = mergeRecords(local, remote, strategies)

    expect(result.merged.tags).toEqual(['a', 'b', 'c'])
  })

  it('uses MAX strategy for numeric fields', () => {
    const local = { id: '1', syncVersion: 5, modifiedAt: 1000 }
    const remote = { id: '1', syncVersion: 3, modifiedAt: 2000 }
    const strategies = { syncVersion: 'max' as const }

    const result = mergeRecords(local, remote, strategies)

    expect(result.merged.syncVersion).toBe(5)
  })

  it('preserves identity fields from local', () => {
    const local = { id: 'local_1', platform: 'claude', modifiedAt: 1000 }
    const remote = { id: 'remote_1', platform: 'chatgpt', modifiedAt: 2000 }
    const strategies = {}

    const result = mergeRecords(local, remote, strategies)

    expect(result.merged.id).toBe('local_1')
    expect(result.merged.platform).toBe('claude')
  })
})

describe('mergeConversation', () => {
  const baseConversation: Conversation = {
    id: 'claude_123',
    platform: 'claude',
    originalId: '123',
    title: 'Test Conversation',
    createdAt: 1000,
    updatedAt: 2000,
    messageCount: 5,
    preview: 'Hello',
    tags: ['work'],
    syncedAt: 1500,
    detailStatus: 'full',
    detailSyncedAt: 1500,
    isFavorite: false,
    favoriteAt: null,
  }

  it('merges conversations with correct strategies', () => {
    const local: Conversation = {
      ...baseConversation,
      title: 'Local Title',
      tags: ['work', 'important'],
      isFavorite: true,
      favoriteAt: 1000,
      modifiedAt: 2000,
    }

    const remote: Conversation = {
      ...baseConversation,
      title: 'Remote Title',
      tags: ['work', 'personal'],
      isFavorite: false,
      favoriteAt: null,
      modifiedAt: 1500,
    }

    const result = mergeConversation(local, remote)

    expect(result.conversation.title).toBe('Local Title') // LWW, local is newer
    expect(result.conversation.tags).toContain('important')
    expect(result.conversation.tags).toContain('personal')
    expect(result.conversation.isFavorite).toBe(true) // OR strategy
    expect(result.needsUserResolution).toBe(false)
  })
})

describe('mergeMessage', () => {
  const baseMessage: Message = {
    id: 'msg_1',
    conversationId: 'conv_1',
    role: 'user',
    content: 'Hello',
    createdAt: 1000,
  }

  it('merges messages with LWW for content', () => {
    const local: Message = {
      ...baseMessage,
      content: 'Local content',
      modifiedAt: 2000,
    }

    const remote: Message = {
      ...baseMessage,
      content: 'Remote content',
      modifiedAt: 1500,
    }

    const result = mergeMessage(local, remote)

    expect(result.message.content).toBe('Local content') // Local is newer
    expect(result.needsUserResolution).toBe(false)
  })

  it('uses AND for deleted flag', () => {
    const local: Message = {
      ...baseMessage,
      deleted: true,
      modifiedAt: 2000,
    }

    const remote: Message = {
      ...baseMessage,
      deleted: false,
      modifiedAt: 1500,
    }

    const result = mergeMessage(local, remote)

    expect(result.message.deleted).toBe(false) // AND: both must be true
  })
})
