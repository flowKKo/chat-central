import { describe, expect, it } from 'vitest'
import {
  CaptureApiResponseSchema,
  GetConversationsSchema,
  GetMessagesSchema,
  GetRecentConversationsSchema,
  SearchSchema,
  SearchWithMatchesSchema,
  ToggleFavoriteSchema,
} from './schemas'

describe('background Message Schemas', () => {
  describe('captureApiResponseSchema', () => {
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

  describe('getConversationsSchema', () => {
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

  describe('getMessagesSchema', () => {
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

  describe('searchSchema', () => {
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

  describe('toggleFavoriteSchema', () => {
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

  describe('searchWithMatchesSchema', () => {
    it('should validate valid message', () => {
      const result = SearchWithMatchesSchema.safeParse({
        action: 'SEARCH_WITH_MATCHES',
        query: 'react',
      })
      expect(result.success).toBe(true)
    })

    it('should validate with optional limit', () => {
      const result = SearchWithMatchesSchema.safeParse({
        action: 'SEARCH_WITH_MATCHES',
        query: 'react',
        limit: 20,
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty query', () => {
      const result = SearchWithMatchesSchema.safeParse({
        action: 'SEARCH_WITH_MATCHES',
        query: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing query', () => {
      const result = SearchWithMatchesSchema.safeParse({
        action: 'SEARCH_WITH_MATCHES',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-positive limit', () => {
      const result = SearchWithMatchesSchema.safeParse({
        action: 'SEARCH_WITH_MATCHES',
        query: 'test',
        limit: 0,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('getRecentConversationsSchema', () => {
    it('should validate minimal message', () => {
      const result = GetRecentConversationsSchema.safeParse({
        action: 'GET_RECENT_CONVERSATIONS',
      })
      expect(result.success).toBe(true)
    })

    it('should validate with optional limit', () => {
      const result = GetRecentConversationsSchema.safeParse({
        action: 'GET_RECENT_CONVERSATIONS',
        limit: 5,
      })
      expect(result.success).toBe(true)
    })

    it('should reject non-positive limit', () => {
      const result = GetRecentConversationsSchema.safeParse({
        action: 'GET_RECENT_CONVERSATIONS',
        limit: -1,
      })
      expect(result.success).toBe(false)
    })
  })
})
