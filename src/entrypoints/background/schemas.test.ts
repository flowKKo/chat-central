import { describe, it, expect } from 'vitest'
import {
  CaptureApiResponseSchema,
  GetConversationsSchema,
  GetMessagesSchema,
  SearchSchema,
  ToggleFavoriteSchema,
} from './schemas'

describe('Background Message Schemas', () => {
  describe('CaptureApiResponseSchema', () => {
    it('should validate valid capture message', () => {
      const result = CaptureApiResponseSchema.safeParse({
        action: 'CAPTURE_API_RESPONSE',
        url: 'https://claude.ai/api/conversations',
        data: { foo: 'bar' },
        timestamp: 1700000000000,
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid URL', () => {
      const result = CaptureApiResponseSchema.safeParse({
        action: 'CAPTURE_API_RESPONSE',
        url: 'not-a-url',
        data: {},
        timestamp: 1700000000000,
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing timestamp', () => {
      const result = CaptureApiResponseSchema.safeParse({
        action: 'CAPTURE_API_RESPONSE',
        url: 'https://claude.ai/api/conversations',
        data: {},
      })
      expect(result.success).toBe(false)
    })

    it('should reject wrong action', () => {
      const result = CaptureApiResponseSchema.safeParse({
        action: 'WRONG_ACTION',
        url: 'https://claude.ai/api/conversations',
        data: {},
        timestamp: 1700000000000,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('GetConversationsSchema', () => {
    it('should validate minimal message', () => {
      const result = GetConversationsSchema.safeParse({
        action: 'GET_CONVERSATIONS',
      })
      expect(result.success).toBe(true)
    })

    it('should validate with optional fields', () => {
      const result = GetConversationsSchema.safeParse({
        action: 'GET_CONVERSATIONS',
        platform: 'claude',
        limit: 50,
        offset: 10,
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid platform', () => {
      const result = GetConversationsSchema.safeParse({
        action: 'GET_CONVERSATIONS',
        platform: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative limit', () => {
      const result = GetConversationsSchema.safeParse({
        action: 'GET_CONVERSATIONS',
        limit: -1,
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative offset', () => {
      const result = GetConversationsSchema.safeParse({
        action: 'GET_CONVERSATIONS',
        offset: -1,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('GetMessagesSchema', () => {
    it('should validate valid message', () => {
      const result = GetMessagesSchema.safeParse({
        action: 'GET_MESSAGES',
        conversationId: 'claude_abc123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty conversationId', () => {
      const result = GetMessagesSchema.safeParse({
        action: 'GET_MESSAGES',
        conversationId: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing conversationId', () => {
      const result = GetMessagesSchema.safeParse({
        action: 'GET_MESSAGES',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('SearchSchema', () => {
    it('should validate valid search message', () => {
      const result = SearchSchema.safeParse({
        action: 'SEARCH',
        query: 'hello world',
      })
      expect(result.success).toBe(true)
    })

    it('should validate with optional filters', () => {
      const result = SearchSchema.safeParse({
        action: 'SEARCH',
        query: 'test',
        filters: { platform: 'claude' },
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing query', () => {
      const result = SearchSchema.safeParse({
        action: 'SEARCH',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ToggleFavoriteSchema', () => {
    it('should validate minimal message', () => {
      const result = ToggleFavoriteSchema.safeParse({
        action: 'TOGGLE_FAVORITE',
        conversationId: 'claude_abc123',
      })
      expect(result.success).toBe(true)
    })

    it('should validate with explicit value', () => {
      const result = ToggleFavoriteSchema.safeParse({
        action: 'TOGGLE_FAVORITE',
        conversationId: 'claude_abc123',
        value: true,
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty conversationId', () => {
      const result = ToggleFavoriteSchema.safeParse({
        action: 'TOGGLE_FAVORITE',
        conversationId: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-boolean value', () => {
      const result = ToggleFavoriteSchema.safeParse({
        action: 'TOGGLE_FAVORITE',
        conversationId: 'claude_abc123',
        value: 'true',
      })
      expect(result.success).toBe(false)
    })
  })
})
