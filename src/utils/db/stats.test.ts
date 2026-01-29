import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@/types'
import { ChatCentralDB } from './schema'
import { upsertConversations } from './repositories/conversations'
import { upsertMessages } from './repositories/messages'
import { getDBStats } from './stats'

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
// getDBStats
// ============================================================================

describe('getDBStats', () => {
  it('should return zeros and nulls for an empty database', async () => {
    const stats = await getDBStats()

    expect(stats.totalConversations).toBe(0)
    expect(stats.totalMessages).toBe(0)
    expect(stats.byPlatform.claude).toBe(0)
    expect(stats.byPlatform.chatgpt).toBe(0)
    expect(stats.byPlatform.gemini).toBe(0)
    expect(stats.oldestConversation).toBeNull()
    expect(stats.newestConversation).toBeNull()
  })

  it('should count total conversations', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1' }),
      makeConversation({ id: 'c2' }),
      makeConversation({ id: 'c3' }),
    ])

    const stats = await getDBStats()
    expect(stats.totalConversations).toBe(3)
  })

  it('should count total messages', async () => {
    await upsertMessages([
      makeMessage({ id: 'm1' }),
      makeMessage({ id: 'm2' }),
      makeMessage({ id: 'm3' }),
      makeMessage({ id: 'm4' }),
    ])

    const stats = await getDBStats()
    expect(stats.totalMessages).toBe(4)
  })

  it('should count conversations by platform', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', platform: 'claude' }),
      makeConversation({ id: 'c2', platform: 'claude' }),
      makeConversation({ id: 'c3', platform: 'chatgpt' }),
      makeConversation({ id: 'c4', platform: 'gemini' }),
      makeConversation({ id: 'c5', platform: 'gemini' }),
      makeConversation({ id: 'c6', platform: 'gemini' }),
    ])

    const stats = await getDBStats()
    expect(stats.byPlatform.claude).toBe(2)
    expect(stats.byPlatform.chatgpt).toBe(1)
    expect(stats.byPlatform.gemini).toBe(3)
  })

  it('should find the oldest conversation timestamp', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', createdAt: 5000 }),
      makeConversation({ id: 'c2', createdAt: 1000 }),
      makeConversation({ id: 'c3', createdAt: 3000 }),
    ])

    const stats = await getDBStats()
    expect(stats.oldestConversation).toBe(1000)
  })

  it('should find the newest conversation timestamp', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', createdAt: 5000 }),
      makeConversation({ id: 'c2', createdAt: 1000 }),
      makeConversation({ id: 'c3', createdAt: 9000 }),
    ])

    const stats = await getDBStats()
    expect(stats.newestConversation).toBe(9000)
  })

  it('should handle single conversation correctly', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', platform: 'chatgpt', createdAt: 4000 }),
    ])

    const stats = await getDBStats()
    expect(stats.totalConversations).toBe(1)
    expect(stats.byPlatform.claude).toBe(0)
    expect(stats.byPlatform.chatgpt).toBe(1)
    expect(stats.byPlatform.gemini).toBe(0)
    expect(stats.oldestConversation).toBe(4000)
    expect(stats.newestConversation).toBe(4000)
  })

  it('should return complete stats with conversations and messages', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', platform: 'claude', createdAt: 1000 }),
      makeConversation({ id: 'c2', platform: 'chatgpt', createdAt: 2000 }),
      makeConversation({ id: 'c3', platform: 'claude', createdAt: 3000 }),
    ])
    await upsertMessages([
      makeMessage({ id: 'm1', conversationId: 'c1' }),
      makeMessage({ id: 'm2', conversationId: 'c1' }),
      makeMessage({ id: 'm3', conversationId: 'c2' }),
    ])

    const stats = await getDBStats()
    expect(stats.totalConversations).toBe(3)
    expect(stats.totalMessages).toBe(3)
    expect(stats.byPlatform.claude).toBe(2)
    expect(stats.byPlatform.chatgpt).toBe(1)
    expect(stats.byPlatform.gemini).toBe(0)
    expect(stats.oldestConversation).toBe(1000)
    expect(stats.newestConversation).toBe(3000)
  })
})
