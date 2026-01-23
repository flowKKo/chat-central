import { describe, it, expect } from 'vitest'
import { parseConversationFromUrl, buildPlaceholderConversation } from './urlParser'

describe('urlParser', () => {
  describe('parseConversationFromUrl', () => {
    it('should parse Claude chat URL', () => {
      const result = parseConversationFromUrl('https://claude.ai/chat/abc123')
      expect(result).toEqual({
        platform: 'claude',
        originalId: 'abc123',
        conversationId: 'claude_abc123',
        url: 'https://claude.ai/chat/abc123',
      })
    })

    it('should parse ChatGPT URL from chatgpt.com', () => {
      const result = parseConversationFromUrl('https://chatgpt.com/c/def456')
      expect(result).toEqual({
        platform: 'chatgpt',
        originalId: 'def456',
        conversationId: 'chatgpt_def456',
        url: 'https://chatgpt.com/c/def456',
      })
    })

    it('should parse ChatGPT URL from chat.openai.com', () => {
      const result = parseConversationFromUrl('https://chat.openai.com/c/ghi789')
      expect(result).toEqual({
        platform: 'chatgpt',
        originalId: 'ghi789',
        conversationId: 'chatgpt_ghi789',
        url: 'https://chat.openai.com/c/ghi789',
      })
    })

    it('should parse Gemini URL', () => {
      const result = parseConversationFromUrl('https://gemini.google.com/app/jkl012')
      expect(result).toEqual({
        platform: 'gemini',
        originalId: 'jkl012',
        conversationId: 'gemini_jkl012',
        url: 'https://gemini.google.com/app/jkl012',
      })
    })

    it('should return null for invalid URL', () => {
      expect(parseConversationFromUrl('not-a-url')).toBeNull()
    })

    it('should return null for unsupported domain', () => {
      expect(parseConversationFromUrl('https://example.com/chat/123')).toBeNull()
    })

    it('should return null for Claude URL without chat ID', () => {
      expect(parseConversationFromUrl('https://claude.ai/settings')).toBeNull()
    })

    it('should return null for ChatGPT URL without conversation ID', () => {
      expect(parseConversationFromUrl('https://chatgpt.com/')).toBeNull()
    })
  })

  describe('buildPlaceholderConversation', () => {
    it('should build placeholder conversation for Claude', () => {
      const parsed = {
        platform: 'claude' as const,
        originalId: 'abc123',
        conversationId: 'claude_abc123',
        url: 'https://claude.ai/chat/abc123',
      }
      const now = 1700000000000

      const result = buildPlaceholderConversation(parsed, now)

      expect(result).toEqual({
        id: 'claude_abc123',
        platform: 'claude',
        originalId: 'abc123',
        title: 'Unknown conversation',
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        preview: '',
        tags: [],
        syncedAt: now,
        detailStatus: 'none',
        detailSyncedAt: null,
        isFavorite: false,
        favoriteAt: null,
        url: 'https://claude.ai/chat/abc123',
      })
    })

    it('should use platform base URL when parsed URL is empty', () => {
      const parsed = {
        platform: 'chatgpt' as const,
        originalId: 'def456',
        conversationId: 'chatgpt_def456',
        url: '',
      }
      const now = 1700000000000

      const result = buildPlaceholderConversation(parsed, now)

      expect(result.url).toBe('https://chatgpt.com')
    })
  })
})
