import { describe, it, expect } from 'vitest'
import { claudeAdapter } from './claude'

describe('claudeAdapter', () => {
  describe('shouldCapture', () => {
    it('should return true for conversation list URL', () => {
      expect(
        claudeAdapter.shouldCapture('https://claude.ai/api/organizations/123/chat_conversations'),
      ).toBe(true)
    })

    it('should return true for conversation detail URL', () => {
      expect(
        claudeAdapter.shouldCapture(
          'https://claude.ai/api/organizations/123/chat_conversations/abc-def-123',
        ),
      ).toBe(true)
    })

    it('should return true for completion URL', () => {
      expect(
        claudeAdapter.shouldCapture(
          'https://claude.ai/api/organizations/123/chat_conversations/abc-def/completion',
        ),
      ).toBe(true)
    })

    it('should return false for unrelated URLs', () => {
      expect(claudeAdapter.shouldCapture('https://claude.ai/api/user')).toBe(false)
      expect(claudeAdapter.shouldCapture('https://google.com')).toBe(false)
    })
  })

  describe('getEndpointType', () => {
    it('should detect list endpoint', () => {
      expect(
        claudeAdapter.getEndpointType('https://claude.ai/api/organizations/123/chat_conversations'),
      ).toBe('list')
      expect(
        claudeAdapter.getEndpointType(
          'https://claude.ai/api/organizations/123/chat_conversations?limit=20',
        ),
      ).toBe('list')
    })

    it('should detect detail endpoint', () => {
      expect(
        claudeAdapter.getEndpointType(
          'https://claude.ai/api/organizations/123/chat_conversations/abc-def-123',
        ),
      ).toBe('detail')
    })

    it('should detect stream endpoint', () => {
      expect(
        claudeAdapter.getEndpointType(
          'https://claude.ai/api/organizations/123/chat_conversations/abc-def-123/completion',
        ),
      ).toBe('stream')
    })

    it('should return unknown for unmatched URLs', () => {
      expect(claudeAdapter.getEndpointType('https://claude.ai/api/user')).toBe('unknown')
    })
  })

  describe('extractConversationId', () => {
    it('should extract ID from detail URL', () => {
      expect(
        claudeAdapter.extractConversationId(
          'https://claude.ai/api/organizations/123/chat_conversations/abc-def-456',
        ),
      ).toBe('abc-def-456')
    })

    it('should extract ID from stream URL', () => {
      expect(
        claudeAdapter.extractConversationId(
          'https://claude.ai/api/organizations/123/chat_conversations/abc-def-789/completion',
        ),
      ).toBe('abc-def-789')
    })

    it('should return null for list URL', () => {
      expect(
        claudeAdapter.extractConversationId(
          'https://claude.ai/api/organizations/123/chat_conversations',
        ),
      ).toBe(null)
    })
  })

  describe('buildConversationUrl', () => {
    it('should build correct URL', () => {
      expect(claudeAdapter.buildConversationUrl('abc-123')).toBe('https://claude.ai/chat/abc-123')
    })
  })

  describe('parseConversationList', () => {
    it('should parse array of conversations', () => {
      const data = [
        {
          uuid: 'conv-1',
          name: 'Test Chat 1',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T12:00:00Z',
          message_count: 5,
          preview: 'Hello world',
        },
        {
          uuid: 'conv-2',
          name: 'Test Chat 2',
          created_at: '2024-01-16T10:00:00Z',
          updated_at: '2024-01-16T12:00:00Z',
        },
      ]

      const result = claudeAdapter.parseConversationList(data)

      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe('claude_conv-1')
      expect(result[0]!.platform).toBe('claude')
      expect(result[0]!.originalId).toBe('conv-1')
      expect(result[0]!.title).toBe('Test Chat 1')
      expect(result[0]!.messageCount).toBe(5)
      expect(result[0]!.preview).toBe('Hello world')
      expect(result[0]!.url).toBe('https://claude.ai/chat/conv-1')
    })

    it('should parse nested data structure', () => {
      const data = {
        data: {
          chat_conversations: [{ uuid: 'conv-1', name: 'Nested Chat' }],
        },
      }

      const result = claudeAdapter.parseConversationList(data)
      expect(result).toHaveLength(1)
      expect(result[0]!.title).toBe('Nested Chat')
    })

    it('should handle JSON string input', () => {
      const data = JSON.stringify([{ uuid: 'conv-1', name: 'JSON Chat' }])
      const result = claudeAdapter.parseConversationList(data)
      expect(result).toHaveLength(1)
      expect(result[0]!.title).toBe('JSON Chat')
    })

    it('should filter out invalid items', () => {
      const data = [
        { uuid: 'valid', name: 'Valid' },
        { name: 'No ID' }, // Missing uuid
        null,
        'invalid',
      ]

      const result = claudeAdapter.parseConversationList(data)
      expect(result).toHaveLength(1)
    })

    it('should return empty array for invalid data', () => {
      expect(claudeAdapter.parseConversationList(null)).toEqual([])
      expect(claudeAdapter.parseConversationList('invalid')).toEqual([])
      expect(claudeAdapter.parseConversationList(123)).toEqual([])
    })
  })

  describe('parseConversationDetail', () => {
    it('should parse conversation with messages', () => {
      const data = {
        uuid: 'conv-123',
        name: 'Detail Chat',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T12:00:00Z',
        chat_messages: [
          {
            uuid: 'msg-1',
            sender: 'human',
            text: 'Hello, Claude!',
            created_at: '2024-01-15T10:00:00Z',
          },
          {
            uuid: 'msg-2',
            sender: 'assistant',
            text: 'Hello! How can I help you?',
            created_at: '2024-01-15T10:01:00Z',
          },
        ],
      }

      const result = claudeAdapter.parseConversationDetail(data)

      expect(result).not.toBeNull()
      expect(result!.conversation.id).toBe('claude_conv-123')
      expect(result!.conversation.title).toBe('Detail Chat')
      expect(result!.messages).toHaveLength(2)
      expect(result!.messages[0]!.role).toBe('user')
      expect(result!.messages[0]!.content).toBe('Hello, Claude!')
      expect(result!.messages[1]!.role).toBe('assistant')
    })

    it('should extract content from array format', () => {
      const data = {
        uuid: 'conv-1',
        messages: [
          {
            uuid: 'msg-1',
            sender: 'human',
            content: [
              { type: 'text', text: 'Part 1' },
              { type: 'text', text: 'Part 2' },
            ],
            created_at: '2024-01-15T10:00:00Z',
          },
        ],
      }

      const result = claudeAdapter.parseConversationDetail(data)
      expect(result!.messages[0]!.content).toBe('Part 1\nPart 2')
    })

    it('should handle missing title by using first user message', () => {
      const data = {
        uuid: 'conv-1',
        messages: [
          {
            uuid: 'msg-1',
            sender: 'human',
            text: 'This is the first message content',
            created_at: '2024-01-15T10:00:00Z',
          },
        ],
      }

      const result = claudeAdapter.parseConversationDetail(data)
      expect(result!.conversation.title).toBe('This is the first message content')
    })

    it('should return null for invalid data', () => {
      expect(claudeAdapter.parseConversationDetail(null)).toBeNull()
      expect(claudeAdapter.parseConversationDetail({})).toBeNull()
      expect(claudeAdapter.parseConversationDetail({ uuid: 'x' })).toBeNull() // No messages
    })
  })

  describe('parseStreamResponse', () => {
    it('should parse SSE stream data', () => {
      const sseData = `data: {"conversation_id":"conv-123","message":{"uuid":"msg-1","created_at":"2024-01-15T10:00:00Z"},"completion":"Hello"}

data: {"completion":" world!"}

data: [DONE]`

      const result = claudeAdapter.parseStreamResponse!(
        sseData,
        'https://claude.ai/api/organizations/123/chat_conversations/conv-123/completion',
      )

      expect(result).not.toBeNull()
      expect(result!.conversation.id).toBe('claude_conv-123')
      expect(result!.messages).toHaveLength(1)
      expect(result!.messages[0]!.role).toBe('assistant')
      expect(result!.messages[0]!.content).toBe('Hello world!')
    })

    it('should return null for non-string non-SSE input', () => {
      // Events array format is currently not fully supported
      // because stringified objects don't include "data:" prefix
      const data = {
        events: [{ conversation_id: 'conv-456', completion: 'Test' }],
      }

      const result = claudeAdapter.parseStreamResponse!(
        data,
        'https://claude.ai/api/organizations/123/chat_conversations/conv-456/completion',
      )

      // Currently returns null because the events don't have "data:" prefix after JSON.stringify
      expect(result).toBeNull()
    })

    it('should return null for empty content', () => {
      const result = claudeAdapter.parseStreamResponse!(
        'data: {"conversation_id":"conv-1"}\n\n',
        'https://claude.ai/api/organizations/123/chat_conversations/conv-1/completion',
      )
      expect(result).toBeNull()
    })
  })
})
