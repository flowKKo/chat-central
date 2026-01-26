import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@/types'
import { ChatCentralDB } from './schema'
import {
  deleteConversation,
  getAllConversationsForExport,
  getAllTags,
  getConversationById,
  getConversationByOriginalId,
  getConversationCount,
  getConversations,
  getFavoriteConversationCount,
  softDeleteConversation,
  updateConversationFavorite,
  updateConversationTags,
  upsertConversation,
  upsertConversations,
} from './repositories/conversations'
import {
  deleteMessagesByConversationId,
  getAllMessagesForExport,
  getExistingMessageIds,
  getMessagesByConversationId,
  getMessagesByIds,
  upsertMessages,
} from './repositories/messages'
import { searchConversations, searchConversationsWithMatches, searchMessages } from './search'
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

// Re-bind all repository functions to use our test db instance
// by replacing the singleton module's `db` export
let db: ChatCentralDB

beforeEach(async () => {
  // Create a fresh database for each test
  db = new ChatCentralDB()

  // Replace the singleton db with our test instance
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
// Conversations Repository
// ============================================================================

describe('conversations repository', () => {
  describe('upsertConversation', () => {
    it('should insert a new conversation', async () => {
      const conv = makeConversation({ id: 'claude_abc' })
      await upsertConversation(conv)

      const result = await getConversationById('claude_abc')
      expect(result).toBeDefined()
      expect(result!.title).toBe('Test conversation')
    })

    it('should update an existing conversation', async () => {
      const conv = makeConversation({ id: 'claude_abc' })
      await upsertConversation(conv)

      const updated = { ...conv, title: 'Updated title' }
      await upsertConversation(updated)

      const result = await getConversationById('claude_abc')
      expect(result!.title).toBe('Updated title')
    })
  })

  describe('upsertConversations', () => {
    it('should bulk insert conversations', async () => {
      const convs = [
        makeConversation({ id: 'c1', platform: 'claude' }),
        makeConversation({ id: 'c2', platform: 'chatgpt' }),
        makeConversation({ id: 'c3', platform: 'gemini' }),
      ]
      await upsertConversations(convs)

      const count = await getConversationCount()
      expect(count).toBe(3)
    })
  })

  describe('getConversationById', () => {
    it('should return undefined for non-existent ID', async () => {
      const result = await getConversationById('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('getConversationByOriginalId', () => {
    it('should find conversation by platform and original ID', async () => {
      await upsertConversation(
        makeConversation({ id: 'claude_abc', platform: 'claude', originalId: 'abc' }),
      )

      const result = await getConversationByOriginalId('claude', 'abc')
      expect(result).toBeDefined()
      expect(result!.id).toBe('claude_abc')
    })

    it('should return undefined if not found', async () => {
      const result = await getConversationByOriginalId('chatgpt', 'xyz')
      expect(result).toBeUndefined()
    })
  })

  describe('getConversations', () => {
    beforeEach(async () => {
      await upsertConversations([
        makeConversation({ id: 'c1', platform: 'claude', updatedAt: 3000, createdAt: 1000 }),
        makeConversation({ id: 'c2', platform: 'chatgpt', updatedAt: 1000, createdAt: 2000 }),
        makeConversation({ id: 'c3', platform: 'claude', updatedAt: 2000, createdAt: 3000 }),
      ])
    })

    it('should return all conversations sorted by updatedAt desc', async () => {
      const results = await getConversations()
      expect(results).toHaveLength(3)
      expect(results[0]!.id).toBe('c1') // updatedAt: 3000
      expect(results[1]!.id).toBe('c3') // updatedAt: 2000
      expect(results[2]!.id).toBe('c2') // updatedAt: 1000
    })

    it('should filter by platform', async () => {
      const results = await getConversations({ platform: 'claude' })
      expect(results).toHaveLength(2)
      results.forEach((r) => expect(r.platform).toBe('claude'))
    })

    it('should support pagination', async () => {
      const page1 = await getConversations({ limit: 2, offset: 0 })
      expect(page1).toHaveLength(2)

      const page2 = await getConversations({ limit: 2, offset: 2 })
      expect(page2).toHaveLength(1)
    })

    it('should filter favorites only', async () => {
      await updateConversationFavorite('c1', true)

      const results = await getConversations({ favoritesOnly: true })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('c1')
    })
  })

  describe('updateConversationFavorite', () => {
    it('should set favorite status', async () => {
      await upsertConversation(makeConversation({ id: 'c1' }))

      const result = await updateConversationFavorite('c1', true)
      expect(result).not.toBeNull()
      expect(result!.isFavorite).toBe(true)
      expect(result!.favoriteAt).toBeGreaterThan(0)
    })

    it('should unset favorite status', async () => {
      await upsertConversation(makeConversation({ id: 'c1', isFavorite: true, favoriteAt: 1000 }))

      const result = await updateConversationFavorite('c1', false)
      expect(result!.isFavorite).toBe(false)
      expect(result!.favoriteAt).toBeNull()
    })

    it('should return null for non-existent conversation', async () => {
      const result = await updateConversationFavorite('nonexistent', true)
      expect(result).toBeNull()
    })
  })

  describe('deleteConversation', () => {
    it('should delete conversation and its messages', async () => {
      await upsertConversation(makeConversation({ id: 'c1' }))
      await upsertMessages([
        makeMessage({ id: 'm1', conversationId: 'c1' }),
        makeMessage({ id: 'm2', conversationId: 'c1' }),
      ])

      await deleteConversation('c1')

      const conv = await getConversationById('c1')
      expect(conv).toBeUndefined()

      const msgs = await getMessagesByConversationId('c1')
      expect(msgs).toHaveLength(0)
    })
  })

  describe('softDeleteConversation', () => {
    it('should mark conversation and messages as deleted', async () => {
      await upsertConversation(makeConversation({ id: 'c1' }))
      await upsertMessages([makeMessage({ id: 'm1', conversationId: 'c1' })])

      await softDeleteConversation('c1')

      const conv = await getConversationById('c1')
      expect(conv!.deleted).toBe(true)
      expect(conv!.deletedAt).toBeGreaterThan(0)
      expect(conv!.dirty).toBe(true)
    })
  })

  describe('getConversationCount', () => {
    it('should count all conversations', async () => {
      await upsertConversations([
        makeConversation({ id: 'c1', platform: 'claude' }),
        makeConversation({ id: 'c2', platform: 'chatgpt' }),
      ])

      expect(await getConversationCount()).toBe(2)
    })

    it('should count by platform', async () => {
      await upsertConversations([
        makeConversation({ id: 'c1', platform: 'claude' }),
        makeConversation({ id: 'c2', platform: 'chatgpt' }),
        makeConversation({ id: 'c3', platform: 'claude' }),
      ])

      expect(await getConversationCount('claude')).toBe(2)
      expect(await getConversationCount('chatgpt')).toBe(1)
      expect(await getConversationCount('gemini')).toBe(0)
    })
  })

  describe('getFavoriteConversationCount', () => {
    it('should count favorite conversations', async () => {
      await upsertConversations([
        makeConversation({ id: 'c1', isFavorite: true, favoriteAt: 1000 }),
        makeConversation({ id: 'c2', isFavorite: false }),
        makeConversation({ id: 'c3', isFavorite: true, favoriteAt: 2000 }),
      ])

      expect(await getFavoriteConversationCount()).toBe(2)
    })

    it('should count favorites by platform', async () => {
      await upsertConversations([
        makeConversation({ id: 'c1', platform: 'claude', isFavorite: true, favoriteAt: 1000 }),
        makeConversation({ id: 'c2', platform: 'chatgpt', isFavorite: true, favoriteAt: 2000 }),
        makeConversation({ id: 'c3', platform: 'claude', isFavorite: false }),
      ])

      expect(await getFavoriteConversationCount('claude')).toBe(1)
      expect(await getFavoriteConversationCount('chatgpt')).toBe(1)
    })
  })

  describe('getAllTags', () => {
    it('should return unique sorted tags', async () => {
      await upsertConversations([
        makeConversation({ id: 'c1', tags: ['work', 'coding'] }),
        makeConversation({ id: 'c2', tags: ['work', 'design'] }),
        makeConversation({ id: 'c3', tags: [] }),
      ])

      const tags = await getAllTags()
      expect(tags).toEqual(['coding', 'design', 'work'])
    })

    it('should return empty array when no tags', async () => {
      await upsertConversation(makeConversation({ id: 'c1', tags: [] }))
      const tags = await getAllTags()
      expect(tags).toEqual([])
    })
  })

  describe('updateConversationTags', () => {
    it('should update tags and mark dirty', async () => {
      await upsertConversation(makeConversation({ id: 'c1', tags: [] }))

      const result = await updateConversationTags('c1', ['new-tag'])
      expect(result).not.toBeNull()
      expect(result!.tags).toEqual(['new-tag'])
      expect(result!.dirty).toBe(true)
    })

    it('should return null for non-existent conversation', async () => {
      const result = await updateConversationTags('nonexistent', ['tag'])
      expect(result).toBeNull()
    })
  })

  describe('getAllConversationsForExport', () => {
    it('should exclude deleted conversations by default', async () => {
      await upsertConversations([
        makeConversation({ id: 'c1', deleted: false }),
        makeConversation({ id: 'c2', deleted: true }),
      ])

      const results = await getAllConversationsForExport()
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('c1')
    })

    it('should include deleted when requested', async () => {
      await upsertConversations([
        makeConversation({ id: 'c1', deleted: false }),
        makeConversation({ id: 'c2', deleted: true }),
      ])

      const results = await getAllConversationsForExport({ includeDeleted: true })
      expect(results).toHaveLength(2)
    })

    it('should filter by platforms', async () => {
      await upsertConversations([
        makeConversation({ id: 'c1', platform: 'claude' }),
        makeConversation({ id: 'c2', platform: 'chatgpt' }),
        makeConversation({ id: 'c3', platform: 'gemini' }),
      ])

      const results = await getAllConversationsForExport({ platforms: ['claude', 'gemini'] })
      expect(results).toHaveLength(2)
    })
  })
})

// ============================================================================
// Messages Repository
// ============================================================================

describe('messages repository', () => {
  describe('upsertMessages', () => {
    it('should insert messages', async () => {
      await upsertMessages([
        makeMessage({ id: 'm1', conversationId: 'c1', createdAt: 100 }),
        makeMessage({ id: 'm2', conversationId: 'c1', createdAt: 200 }),
      ])

      const msgs = await getMessagesByConversationId('c1')
      expect(msgs).toHaveLength(2)
    })
  })

  describe('getMessagesByConversationId', () => {
    it('should return messages sorted by createdAt', async () => {
      await upsertMessages([
        makeMessage({ id: 'm2', conversationId: 'c1', createdAt: 200 }),
        makeMessage({ id: 'm1', conversationId: 'c1', createdAt: 100 }),
        makeMessage({ id: 'm3', conversationId: 'c1', createdAt: 300 }),
      ])

      const msgs = await getMessagesByConversationId('c1')
      expect(msgs.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    })

    it('should only return messages for the given conversation', async () => {
      await upsertMessages([
        makeMessage({ id: 'm1', conversationId: 'c1' }),
        makeMessage({ id: 'm2', conversationId: 'c2' }),
      ])

      const msgs = await getMessagesByConversationId('c1')
      expect(msgs).toHaveLength(1)
      expect(msgs[0]!.id).toBe('m1')
    })

    it('should return empty array for unknown conversation', async () => {
      const msgs = await getMessagesByConversationId('nonexistent')
      expect(msgs).toHaveLength(0)
    })
  })

  describe('deleteMessagesByConversationId', () => {
    it('should delete all messages for a conversation', async () => {
      await upsertMessages([
        makeMessage({ id: 'm1', conversationId: 'c1' }),
        makeMessage({ id: 'm2', conversationId: 'c1' }),
        makeMessage({ id: 'm3', conversationId: 'c2' }),
      ])

      await deleteMessagesByConversationId('c1')

      expect(await getMessagesByConversationId('c1')).toHaveLength(0)
      expect(await getMessagesByConversationId('c2')).toHaveLength(1)
    })
  })

  describe('getExistingMessageIds', () => {
    it('should return set of existing IDs', async () => {
      await upsertMessages([makeMessage({ id: 'm1' }), makeMessage({ id: 'm2' })])

      const result = await getExistingMessageIds(['m1', 'm2', 'm3'])
      expect(result).toEqual(new Set(['m1', 'm2']))
    })

    it('should return empty set for empty input', async () => {
      const result = await getExistingMessageIds([])
      expect(result.size).toBe(0)
    })
  })

  describe('getMessagesByIds', () => {
    it('should return map of messages by ID', async () => {
      await upsertMessages([
        makeMessage({ id: 'm1', content: 'Hello' }),
        makeMessage({ id: 'm2', content: 'World' }),
      ])

      const result = await getMessagesByIds(['m1', 'm2', 'm3'])
      expect(result.size).toBe(2)
      expect(result.get('m1')!.content).toBe('Hello')
      expect(result.get('m2')!.content).toBe('World')
      expect(result.has('m3')).toBe(false)
    })

    it('should return empty map for empty input', async () => {
      const result = await getMessagesByIds([])
      expect(result.size).toBe(0)
    })
  })

  describe('getAllMessagesForExport', () => {
    it('should return messages for given conversations', async () => {
      await upsertMessages([
        makeMessage({ id: 'm1', conversationId: 'c1' }),
        makeMessage({ id: 'm2', conversationId: 'c2' }),
        makeMessage({ id: 'm3', conversationId: 'c3' }),
      ])

      const results = await getAllMessagesForExport(['c1', 'c2'])
      expect(results).toHaveLength(2)
    })

    it('should exclude deleted messages by default', async () => {
      await upsertMessages([
        makeMessage({ id: 'm1', conversationId: 'c1', deleted: false }),
        makeMessage({ id: 'm2', conversationId: 'c1', deleted: true }),
      ])

      const results = await getAllMessagesForExport(['c1'])
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('m1')
    })

    it('should return empty array for empty conversation IDs', async () => {
      const results = await getAllMessagesForExport([])
      expect(results).toHaveLength(0)
    })
  })
})

// ============================================================================
// Search
// ============================================================================

describe('search', () => {
  beforeEach(async () => {
    await upsertConversations([
      makeConversation({
        id: 'c1',
        title: 'React hooks discussion',
        preview: 'How to use useEffect',
        updatedAt: 3000,
      }),
      makeConversation({
        id: 'c2',
        title: 'Python data analysis',
        preview: 'Using pandas library',
        updatedAt: 2000,
      }),
      makeConversation({
        id: 'c3',
        title: 'CSS grid layout',
        preview: 'How to use grid',
        updatedAt: 1000,
      }),
    ])
    await upsertMessages([
      makeMessage({ id: 'm1', conversationId: 'c1', content: 'Tell me about React hooks' }),
      makeMessage({ id: 'm2', conversationId: 'c2', content: 'How to use pandas for React' }),
      makeMessage({ id: 'm3', conversationId: 'c3', content: 'CSS grid is great' }),
    ])
  })

  describe('searchConversations', () => {
    it('should find conversations by title', async () => {
      const results = await searchConversations('React')
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('c1')
    })

    it('should be case-insensitive', async () => {
      const results = await searchConversations('react')
      expect(results).toHaveLength(1)
    })

    it('should return empty for no matches', async () => {
      const results = await searchConversations('nonexistent')
      expect(results).toHaveLength(0)
    })
  })

  describe('searchConversationsWithMatches', () => {
    it('should return title matches', async () => {
      const results = await searchConversationsWithMatches('React')
      expect(results.length).toBeGreaterThanOrEqual(1)

      const reactResult = results.find((r) => r.conversation.id === 'c1')
      expect(reactResult).toBeDefined()
      expect(reactResult!.matches.some((m) => m.type === 'title')).toBe(true)
    })

    it('should return message matches', async () => {
      const results = await searchConversationsWithMatches('pandas')
      expect(results.length).toBeGreaterThanOrEqual(1)

      const pandasResult = results.find((r) => r.conversation.id === 'c2')
      expect(pandasResult).toBeDefined()
    })

    it('should combine title and message matches for same conversation', async () => {
      // "React" appears in c1's title AND in c2's message content
      const results = await searchConversationsWithMatches('React')
      expect(results.length).toBe(2) // c1 (title) + c2 (message)
    })

    it('should sort results by updatedAt desc', async () => {
      const results = await searchConversationsWithMatches('how')
      // "how" appears in c1 preview (updatedAt: 3000) and c3 preview (updatedAt: 1000)
      expect(results.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.conversation.updatedAt).toBeGreaterThanOrEqual(
          results[i]!.conversation.updatedAt,
        )
      }
    })
  })

  describe('searchMessages', () => {
    it('should find messages by content', async () => {
      const results = await searchMessages('hooks')
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('m1')
    })

    it('should be case-insensitive', async () => {
      const results = await searchMessages('HOOKS')
      expect(results).toHaveLength(1)
    })
  })
})

// ============================================================================
// Stats
// ============================================================================

describe('stats', () => {
  describe('getDBStats', () => {
    it('should return correct stats', async () => {
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

    it('should return null timestamps when empty', async () => {
      const stats = await getDBStats()
      expect(stats.totalConversations).toBe(0)
      expect(stats.totalMessages).toBe(0)
      expect(stats.oldestConversation).toBeNull()
      expect(stats.newestConversation).toBeNull()
    })
  })
})
