import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildConversation, parseConversationListPayload } from './list'

describe('buildConversation', () => {
  it('should build a conversation with normalized ID', () => {
    const result = buildConversation('c_abc123', 'Test Title', 1700000000000, 1700001000000)
    expect(result.id).toBe('gemini_abc123')
    expect(result.originalId).toBe('abc123')
    expect(result.platform).toBe('gemini')
    expect(result.title).toBe('Test Title')
    expect(result.createdAt).toBe(1700000000000)
    expect(result.updatedAt).toBe(1700000000000)
    expect(result.url).toBe('https://gemini.google.com/app/abc123')
  })

  it('should use now as timestamp when createdAt is 0', () => {
    const result = buildConversation('c_abc123', 'Title', 0, 1700001000000)
    expect(result.createdAt).toBe(1700001000000)
    expect(result.updatedAt).toBe(1700001000000)
  })

  it('should handle IDs without c_ prefix', () => {
    const result = buildConversation('abc123', 'Title', 1700000000000, 1700001000000)
    expect(result.id).toBe('gemini_abc123')
    expect(result.originalId).toBe('abc123')
  })

  it('should set default field values', () => {
    const result = buildConversation('c_abc', 'T', 1000, 2000)
    expect(result.messageCount).toBe(0)
    expect(result.preview).toBe('')
    expect(result.tags).toEqual([])
    expect(result.detailStatus).toBe('none')
    expect(result.detailSyncedAt).toBeNull()
    expect(result.isFavorite).toBe(false)
    expect(result.favoriteAt).toBeNull()
  })
})

describe('parseConversationListPayload', () => {
  const now = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should parse conversations from array format', () => {
    // Array format: [conversationId, title, ..., timestamp]
    const payload = [
      [
        'c_abc123',
        'My Conversation',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [1700000000, 0],
      ],
    ]
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(1)
    expect(result[0]!.title).toBe('My Conversation')
    expect(result[0]!.id).toBe('gemini_abc123')
  })

  it('should parse conversations from object format', () => {
    const payload = [{ conversationId: 'c_abc', title: 'Object Chat', createdAt: 1700000000000 }]
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(1)
    expect(result[0]!.title).toBe('Object Chat')
  })

  it('should parse conversations using alternate object keys', () => {
    const payload = [{ id: 'c_xyz', t: 'Short Key Chat', created_at: 1700000000000 }]
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(1)
    expect(result[0]!.title).toBe('Short Key Chat')
  })

  it('should deduplicate conversations by ID, keeping latest', () => {
    const payload = [
      ['c_abc', 'Version 1', null, null, null, null, null, null, null, null, [1700000000, 0]],
      ['c_abc', 'Version 2', null, null, null, null, null, null, null, null, [1700001000, 0]],
    ]
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(1)
    // Should keep the later version
    expect(result[0]!.updatedAt).toBe(1700001000000)
  })

  it('should skip items where title looks like a conversation ID', () => {
    const payload = [
      ['c_abc', 'c_def123', null, null, null, null, null, null, null, null, [1700000000, 0]],
    ]
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(0)
  })

  it('should skip items where title looks like a response ID', () => {
    const payload = [
      ['c_abc', 'rc_def123', null, null, null, null, null, null, null, null, [1700000000, 0]],
    ]
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(0)
  })

  it('should skip items where title starts with http', () => {
    const payload = [
      [
        'c_abc',
        'https://example.com',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [1700000000, 0],
      ],
    ]
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(0)
  })

  it('should return empty array for empty/null payload', () => {
    expect(parseConversationListPayload(null, now)).toEqual([])
    expect(parseConversationListPayload([], now)).toEqual([])
    expect(parseConversationListPayload('', now)).toEqual([])
  })

  it('should skip array items with fewer than 3 elements', () => {
    const payload = [['c_abc', 'Title']] // only 2 elements
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(0)
  })

  it('should skip array items without a valid conversation ID', () => {
    const payload = [
      [
        'not_a_conv_id',
        'Some Title',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [1700000000, 0],
      ],
    ]
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(0)
  })

  it('should skip array items without a timestamp', () => {
    const payload = [['c_abc', 'Title', null]]
    const result = parseConversationListPayload(payload, now)
    expect(result).toHaveLength(0)
  })
})
