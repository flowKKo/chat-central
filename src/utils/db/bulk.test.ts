import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@/types'
import { ChatCentralDB } from './schema'
import { upsertConversations } from './repositories/conversations'
import { upsertMessages } from './repositories/messages'
import { clearAllData, clearPlatformData } from './bulk'

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
// clearAllData
// ============================================================================

describe('clearAllData', () => {
  it('should remove all conversations and messages', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', platform: 'claude' }),
      makeConversation({ id: 'c2', platform: 'chatgpt' }),
      makeConversation({ id: 'c3', platform: 'gemini' }),
    ])
    await upsertMessages([
      makeMessage({ id: 'm1', conversationId: 'c1' }),
      makeMessage({ id: 'm2', conversationId: 'c2' }),
      makeMessage({ id: 'm3', conversationId: 'c3' }),
    ])

    await clearAllData()

    const convCount = await db.conversations.count()
    const msgCount = await db.messages.count()
    expect(convCount).toBe(0)
    expect(msgCount).toBe(0)
  })

  it('should handle empty database without error', async () => {
    await clearAllData()

    const convCount = await db.conversations.count()
    const msgCount = await db.messages.count()
    expect(convCount).toBe(0)
    expect(msgCount).toBe(0)
  })
})

// ============================================================================
// clearPlatformData
// ============================================================================

describe('clearPlatformData', () => {
  it('should remove only conversations for the specified platform', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', platform: 'claude' }),
      makeConversation({ id: 'c2', platform: 'chatgpt' }),
      makeConversation({ id: 'c3', platform: 'claude' }),
      makeConversation({ id: 'c4', platform: 'gemini' }),
    ])

    await clearPlatformData('claude')

    const remaining = await db.conversations.toArray()
    expect(remaining).toHaveLength(2)
    expect(remaining.map((c) => c.id).sort()).toEqual(['c2', 'c4'])
  })

  it('should cascade delete messages belonging to removed conversations', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', platform: 'claude' }),
      makeConversation({ id: 'c2', platform: 'chatgpt' }),
    ])
    await upsertMessages([
      makeMessage({ id: 'm1', conversationId: 'c1' }),
      makeMessage({ id: 'm2', conversationId: 'c1' }),
      makeMessage({ id: 'm3', conversationId: 'c2' }),
    ])

    await clearPlatformData('claude')

    const remainingMessages = await db.messages.toArray()
    expect(remainingMessages).toHaveLength(1)
    expect(remainingMessages[0]!.id).toBe('m3')
  })

  it('should handle platform with no conversations without error', async () => {
    await upsertConversations([makeConversation({ id: 'c1', platform: 'claude' })])

    await clearPlatformData('gemini')

    const remaining = await db.conversations.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]!.id).toBe('c1')
  })

  it('should not affect other platforms when clearing one', async () => {
    await upsertConversations([
      makeConversation({ id: 'c1', platform: 'claude' }),
      makeConversation({ id: 'c2', platform: 'chatgpt' }),
      makeConversation({ id: 'c3', platform: 'gemini' }),
    ])
    await upsertMessages([
      makeMessage({ id: 'm1', conversationId: 'c1' }),
      makeMessage({ id: 'm2', conversationId: 'c2' }),
      makeMessage({ id: 'm3', conversationId: 'c3' }),
    ])

    await clearPlatformData('chatgpt')

    const convs = await db.conversations.toArray()
    expect(convs).toHaveLength(2)
    expect(convs.map((c) => c.platform).sort()).toEqual(['claude', 'gemini'])

    const msgs = await db.messages.toArray()
    expect(msgs).toHaveLength(2)
    expect(msgs.map((m) => m.id).sort()).toEqual(['m1', 'm3'])
  })
})
