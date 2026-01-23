import { describe, it, expect } from 'vitest'
import { chatgptAdapter } from './chatgpt'

describe('chatgptAdapter', () => {
  describe('shouldCapture', () => {
    it('should return true for conversation list URL', () => {
      expect(chatgptAdapter.shouldCapture('https://chatgpt.com/backend-api/conversations')).toBe(
        true
      )
      expect(
        chatgptAdapter.shouldCapture('https://chatgpt.com/backend-api/conversations?limit=20')
      ).toBe(true)
    })

    it('should return true for conversation detail URL', () => {
      expect(
        chatgptAdapter.shouldCapture('https://chatgpt.com/backend-api/conversation/abc-def-123')
      ).toBe(true)
    })

    it('should return true for stream URL', () => {
      expect(chatgptAdapter.shouldCapture('https://chatgpt.com/backend-api/conversation')).toBe(
        true
      )
    })

    it('should return false for unrelated URLs', () => {
      expect(chatgptAdapter.shouldCapture('https://chatgpt.com/api/user')).toBe(false)
      expect(chatgptAdapter.shouldCapture('https://google.com')).toBe(false)
    })
  })

  describe('getEndpointType', () => {
    it('should detect list endpoint', () => {
      expect(chatgptAdapter.getEndpointType('https://chatgpt.com/backend-api/conversations')).toBe(
        'list'
      )
      expect(
        chatgptAdapter.getEndpointType('https://chatgpt.com/backend-api/conversations?offset=0')
      ).toBe('list')
    })

    it('should detect detail endpoint', () => {
      expect(
        chatgptAdapter.getEndpointType('https://chatgpt.com/backend-api/conversation/abc-def-123')
      ).toBe('detail')
    })

    it('should detect stream endpoint', () => {
      expect(chatgptAdapter.getEndpointType('https://chatgpt.com/backend-api/conversation')).toBe(
        'stream'
      )
    })

    it('should return unknown for unmatched URLs', () => {
      expect(chatgptAdapter.getEndpointType('https://chatgpt.com/api/user')).toBe('unknown')
    })
  })

  describe('extractConversationId', () => {
    it('should extract ID from detail URL', () => {
      expect(
        chatgptAdapter.extractConversationId(
          'https://chatgpt.com/backend-api/conversation/abc-def-456'
        )
      ).toBe('abc-def-456')
    })

    it('should return null for list URL', () => {
      expect(
        chatgptAdapter.extractConversationId('https://chatgpt.com/backend-api/conversations')
      ).toBe(null)
    })

    it('should return null for stream URL', () => {
      expect(
        chatgptAdapter.extractConversationId('https://chatgpt.com/backend-api/conversation')
      ).toBe(null)
    })
  })

  describe('buildConversationUrl', () => {
    it('should build correct URL', () => {
      expect(chatgptAdapter.buildConversationUrl('abc-123')).toBe('https://chatgpt.com/c/abc-123')
    })
  })

  describe('parseConversationList', () => {
    it('should parse items array', () => {
      const data = {
        items: [
          {
            id: 'conv-1',
            title: 'Test Chat 1',
            create_time: 1705320000, // Unix timestamp in seconds
            update_time: 1705320600,
          },
          {
            id: 'conv-2',
            title: 'Test Chat 2',
            create_time: '2024-01-16T10:00:00Z',
            update_time: '2024-01-16T12:00:00Z',
          },
        ],
      }

      const result = chatgptAdapter.parseConversationList(data)

      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe('chatgpt_conv-1')
      expect(result[0]!.platform).toBe('chatgpt')
      expect(result[0]!.originalId).toBe('conv-1')
      expect(result[0]!.title).toBe('Test Chat 1')
      expect(result[0]!.url).toBe('https://chatgpt.com/c/conv-1')
    })

    it('should handle conversations array format', () => {
      const data = {
        conversations: [{ id: 'conv-1', title: 'Chat' }],
      }

      const result = chatgptAdapter.parseConversationList(data)
      expect(result).toHaveLength(1)
    })

    it('should handle JSON string input', () => {
      const data = JSON.stringify({
        items: [{ id: 'conv-1', title: 'JSON Chat' }],
      })
      const result = chatgptAdapter.parseConversationList(data)
      expect(result).toHaveLength(1)
      expect(result[0]!.title).toBe('JSON Chat')
    })

    it('should filter out invalid items', () => {
      const data = {
        items: [{ id: 'valid', title: 'Valid' }, { title: 'No ID' }, null],
      }

      const result = chatgptAdapter.parseConversationList(data)
      expect(result).toHaveLength(1)
    })

    it('should return empty array for invalid data', () => {
      expect(chatgptAdapter.parseConversationList(null)).toEqual([])
      expect(chatgptAdapter.parseConversationList('invalid')).toEqual([])
      expect(chatgptAdapter.parseConversationList({ invalid: true })).toEqual([])
    })

    it('should handle timestamps correctly', () => {
      const data = {
        items: [
          { id: 'conv-1', create_time: 1705320000 }, // Seconds
          { id: 'conv-2', create_time: 1705320000000 }, // Milliseconds
        ],
      }

      const result = chatgptAdapter.parseConversationList(data)
      // Both should be converted to milliseconds
      expect(result[0]!.createdAt).toBe(1705320000 * 1000)
      expect(result[1]!.createdAt).toBe(1705320000000)
    })
  })

  describe('parseConversationDetail', () => {
    it('should parse conversation with mapping structure', () => {
      const data = {
        conversation_id: 'conv-123',
        title: 'Detail Chat',
        create_time: 1705320000,
        update_time: 1705320600,
        mapping: {
          'node-1': {
            message: {
              id: 'msg-1',
              author: { role: 'user' },
              content: { parts: ['Hello, ChatGPT!'] },
              create_time: 1705320000,
            },
          },
          'node-2': {
            message: {
              id: 'msg-2',
              author: { role: 'assistant' },
              content: { parts: ['Hello! How can I help you?'] },
              create_time: 1705320100,
            },
          },
          'node-system': {
            message: {
              id: 'msg-system',
              author: { role: 'system' },
              content: { parts: ['System message'] },
            },
          },
        },
      }

      const result = chatgptAdapter.parseConversationDetail(data)

      expect(result).not.toBeNull()
      expect(result!.conversation.id).toBe('chatgpt_conv-123')
      expect(result!.conversation.title).toBe('Detail Chat')
      expect(result!.messages).toHaveLength(2) // System messages filtered out
      expect(result!.messages[0]!.role).toBe('user')
      expect(result!.messages[0]!.content).toBe('Hello, ChatGPT!')
      expect(result!.messages[1]!.role).toBe('assistant')
    })

    it('should handle multipart content', () => {
      const data = {
        id: 'conv-1',
        mapping: {
          'node-1': {
            message: {
              id: 'msg-1',
              author: { role: 'user' },
              content: { parts: ['Part 1', 'Part 2', 'Part 3'] },
              create_time: 1705320000,
            },
          },
        },
      }

      const result = chatgptAdapter.parseConversationDetail(data)
      expect(result!.messages[0]!.content).toBe('Part 1\nPart 2\nPart 3')
    })

    it('should set preview from first user message', () => {
      const data = {
        id: 'conv-1',
        mapping: {
          'node-1': {
            message: {
              id: 'msg-1',
              author: { role: 'user' },
              content: { parts: ['This is the preview text'] },
              create_time: 1705320000,
            },
          },
        },
      }

      const result = chatgptAdapter.parseConversationDetail(data)
      expect(result!.conversation.preview).toBe('This is the preview text')
    })

    it('should return null for invalid data', () => {
      expect(chatgptAdapter.parseConversationDetail(null)).toBeNull()
      expect(chatgptAdapter.parseConversationDetail({})).toBeNull()
      expect(chatgptAdapter.parseConversationDetail('invalid')).toBeNull()
    })
  })

  describe('parseStreamResponse', () => {
    it('should parse SSE stream data', () => {
      const sseData = `data: {"conversation_id":"conv-123","message":{"id":"msg-1","author":{"role":"assistant"},"content":{"parts":["Hello"]},"create_time":1705320000}}

data: {"conversation_id":"conv-123","message":{"id":"msg-1","author":{"role":"assistant"},"content":{"parts":["Hello world!"]},"create_time":1705320000}}

data: [DONE]`

      const result = chatgptAdapter.parseStreamResponse!(
        sseData,
        'https://chatgpt.com/backend-api/conversation'
      )

      expect(result).not.toBeNull()
      expect(result!.conversation.id).toBe('chatgpt_conv-123')
      expect(result!.messages).toHaveLength(1)
      expect(result!.messages[0]!.role).toBe('assistant')
      expect(result!.messages[0]!.content).toBe('Hello world!')
    })

    it('should return null for non-string non-SSE input', () => {
      // Events array format is currently not fully supported
      // because stringified objects don't include "data:" prefix
      const data = {
        events: [
          {
            conversation_id: 'conv-456',
            message: {
              id: 'msg-1',
              author: { role: 'assistant' },
              content: { parts: ['Response'] },
              create_time: 1705320000,
            },
          },
        ],
      }

      const result = chatgptAdapter.parseStreamResponse!(
        data,
        'https://chatgpt.com/backend-api/conversation'
      )

      // Currently returns null because the events don't have "data:" prefix after JSON.stringify
      expect(result).toBeNull()
    })

    it('should deduplicate messages by ID', () => {
      const sseData = `data: {"conversation_id":"conv-123","message":{"id":"msg-1","author":{"role":"assistant"},"content":{"parts":["Hello"]},"create_time":1705320000}}

data: {"conversation_id":"conv-123","message":{"id":"msg-1","author":{"role":"assistant"},"content":{"parts":["Hello world!"]},"create_time":1705320000}}

data: {"conversation_id":"conv-123","message":{"id":"msg-2","author":{"role":"user"},"content":{"parts":["Hi"]},"create_time":1705319900}}`

      const result = chatgptAdapter.parseStreamResponse!(
        sseData,
        'https://chatgpt.com/backend-api/conversation'
      )

      expect(result!.messages).toHaveLength(2)
      // Should keep the longer content
      expect(result!.messages.find((m) => m.id === 'chatgpt_msg-1')!.content).toBe('Hello world!')
    })

    it('should return null for empty stream', () => {
      expect(
        chatgptAdapter.parseStreamResponse!('', 'https://chatgpt.com/backend-api/conversation')
      ).toBeNull()
    })
  })
})
