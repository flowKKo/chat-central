import { describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@/types'
import {
  conversationToMarkdown,
  markdownFrontmatterSchema,
  parseMarkdownExport,
  parseYamlFrontmatter,
  toYamlFrontmatter,
  yamlQuote,
} from './markdown'

// ============================================================================
// Test Helpers
// ============================================================================

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'claude_abc123',
    originalId: 'abc123',
    platform: 'claude',
    title: 'How to implement quicksort',
    preview: 'Can you explain quicksort...',
    summary: 'Discussion about quicksort',
    messageCount: 2,
    createdAt: 1706000000000,
    updatedAt: 1706001000000,
    syncedAt: 1706001000000,
    isFavorite: false,
    favoriteAt: null,
    tags: ['algorithms', 'python'],
    detailStatus: 'full',
    detailSyncedAt: 1706001000000,
    url: 'https://claude.ai/chat/abc123',
    ...overrides,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'claude_abc123',
    role: 'user',
    content: 'Can you explain quicksort?',
    createdAt: 1706000000000,
    ...overrides,
  }
}

// ============================================================================
// yamlQuote
// ============================================================================

describe('yamlQuote', () => {
  it('should return null for null/undefined', () => {
    expect(yamlQuote(null)).toBe('null')
    expect(yamlQuote(undefined)).toBe('null')
  })

  it('should return numbers and booleans as-is', () => {
    expect(yamlQuote(42)).toBe('42')
    expect(yamlQuote(true)).toBe('true')
    expect(yamlQuote(false)).toBe('false')
  })

  it('should return empty string as quoted', () => {
    expect(yamlQuote('')).toBe('""')
  })

  it('should return simple strings bare', () => {
    expect(yamlQuote('hello world')).toBe('hello world')
  })

  it('should quote strings with colons', () => {
    expect(yamlQuote('key: value')).toBe('"key: value"')
  })

  it('should quote strings with quotes', () => {
    expect(yamlQuote('say "hello"')).toBe('"say \\"hello\\""')
  })

  it('should quote strings starting with digits', () => {
    expect(yamlQuote('123abc')).toBe('"123abc"')
  })

  it('should quote YAML keywords', () => {
    expect(yamlQuote('true')).toBe('"true"')
    expect(yamlQuote('null')).toBe('"null"')
    expect(yamlQuote('yes')).toBe('"yes"')
  })

  it('should quote strings with hash', () => {
    expect(yamlQuote('test # comment')).toBe('"test # comment"')
  })

  it('should escape newlines in strings', () => {
    expect(yamlQuote('line1\nline2')).toBe('"line1\\nline2"')
  })

  it('should escape backslashes', () => {
    expect(yamlQuote('path\\to\\file')).toBe('"path\\\\to\\\\file"')
  })
})

// ============================================================================
// toYamlFrontmatter / parseYamlFrontmatter round-trip
// ============================================================================

describe('yAML frontmatter', () => {
  describe('toYamlFrontmatter', () => {
    it('should produce valid frontmatter with fences', () => {
      const result = toYamlFrontmatter({ title: 'Hello' })
      expect(result).toBe('---\ntitle: Hello\n---')
    })

    it('should handle arrays', () => {
      const result = toYamlFrontmatter({ tags: ['a', 'b'] })
      expect(result).toContain('tags:')
      expect(result).toContain('  - a')
      expect(result).toContain('  - b')
    })

    it('should handle empty arrays', () => {
      const result = toYamlFrontmatter({ tags: [] })
      expect(result).toContain('tags: []')
    })

    it('should handle null values', () => {
      const result = toYamlFrontmatter({ favoriteAt: null })
      expect(result).toContain('favoriteAt: null')
    })
  })

  describe('parseYamlFrontmatter', () => {
    it('should parse simple key-value pairs', () => {
      const yaml = '---\ntitle: Hello\ncount: 42\n---'
      const result = parseYamlFrontmatter(yaml)
      expect(result.title).toBe('Hello')
      expect(result.count).toBe(42)
    })

    it('should parse quoted strings', () => {
      const yaml = '---\ntitle: "Hello: World"\n---'
      const result = parseYamlFrontmatter(yaml)
      expect(result.title).toBe('Hello: World')
    })

    it('should parse arrays', () => {
      const yaml = '---\ntags:\n  - algo\n  - python\n---'
      const result = parseYamlFrontmatter(yaml)
      expect(result.tags).toEqual(['algo', 'python'])
    })

    it('should parse empty arrays', () => {
      const yaml = '---\ntags: []\n---'
      const result = parseYamlFrontmatter(yaml)
      expect(result.tags).toEqual([])
    })

    it('should parse null', () => {
      const yaml = '---\nfavoriteAt: null\n---'
      const result = parseYamlFrontmatter(yaml)
      expect(result.favoriteAt).toBeNull()
    })

    it('should parse booleans', () => {
      const yaml = '---\nisFavorite: false\nactive: true\n---'
      const result = parseYamlFrontmatter(yaml)
      expect(result.isFavorite).toBe(false)
      expect(result.active).toBe(true)
    })

    it('should return empty for invalid frontmatter', () => {
      const result = parseYamlFrontmatter('no frontmatter here')
      expect(result).toEqual({})
    })
  })

  describe('round-trip', () => {
    it('should serialize and deserialize consistently', () => {
      const data = {
        title: 'Test',
        count: 42,
        active: true,
        tags: ['a', 'b'],
        note: null,
      }
      const yaml = toYamlFrontmatter(data)
      const parsed = parseYamlFrontmatter(yaml)
      expect(parsed).toEqual(data)
    })

    it('should round-trip strings with special characters', () => {
      const data = {
        title: 'How to: use "quotes" & colons',
        path: 'C:\\Users\\test',
      }
      const yaml = toYamlFrontmatter(data)
      const parsed = parseYamlFrontmatter(yaml)
      expect(parsed.title).toBe(data.title)
      expect(parsed.path).toBe(data.path)
    })
  })
})

// ============================================================================
// markdownFrontmatterSchema
// ============================================================================

describe('markdownFrontmatterSchema', () => {
  it('should validate correct frontmatter data', () => {
    const data = {
      id: 'claude_abc123',
      platform: 'claude',
      originalId: 'abc123',
      title: 'Test',
      createdAt: 1706000000000,
      updatedAt: 1706001000000,
      messageCount: 2,
      preview: 'Hello',
      tags: [],
      isFavorite: false,
      favoriteAt: null,
      detailStatus: 'full',
      detailSyncedAt: 1706001000000,
      syncedAt: 1706001000000,
      exportVersion: '2.0',
      exportedAt: 1706002000000,
    }
    const result = markdownFrontmatterSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('should reject invalid platform', () => {
    const data = {
      id: 'test',
      platform: 'invalid',
      originalId: 'x',
      title: 'T',
      createdAt: 0,
      updatedAt: 0,
      messageCount: 0,
      preview: '',
      tags: [],
      isFavorite: false,
      favoriteAt: null,
      detailStatus: 'none',
      detailSyncedAt: null,
      syncedAt: 0,
      exportVersion: '2.0',
      exportedAt: 0,
    }
    const result = markdownFrontmatterSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// conversationToMarkdown + parseMarkdownExport round-trip
// ============================================================================

describe('conversationToMarkdown', () => {
  it('should produce correct format', () => {
    const conv = makeConversation()
    const messages = [
      makeMessage({ role: 'user', content: 'Can you explain quicksort?' }),
      makeMessage({
        id: 'msg-2',
        role: 'assistant',
        content: 'Quicksort is a divide-and-conquer...',
      }),
    ]

    const md = conversationToMarkdown(conv, messages, 1706002000000)

    expect(md).toContain('---')
    expect(md).toContain('id: claude_abc123')
    expect(md).toContain('platform: claude')
    expect(md).toContain('## User')
    expect(md).toContain('Can you explain quicksort?')
    expect(md).toContain('## Assistant')
    expect(md).toContain('Quicksort is a divide-and-conquer...')
  })

  it('should handle empty message list', () => {
    const conv = makeConversation()
    const md = conversationToMarkdown(conv, [], 1706002000000)

    expect(md).toContain('---')
    expect(md).toContain('id: claude_abc123')
    expect(md).not.toContain('## User')
    expect(md).not.toContain('## Assistant')
  })

  it('should omit optional fields when missing', () => {
    const conv = makeConversation({ summary: undefined, url: undefined })
    const md = conversationToMarkdown(conv, [], 1706002000000)

    expect(md).not.toContain('summary:')
    expect(md).not.toContain('url:')
  })
})

describe('parseMarkdownExport', () => {
  it('should parse exported markdown back to conversation + messages', () => {
    const conv = makeConversation()
    const messages = [
      makeMessage({ role: 'user', content: 'Hello' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hi there!' }),
    ]

    const md = conversationToMarkdown(conv, messages, 1706002000000)
    const result = parseMarkdownExport(md)

    expect(result.conversation.id).toBe('claude_abc123')
    expect(result.conversation.platform).toBe('claude')
    expect(result.conversation.title).toBe('How to implement quicksort')
    expect(result.conversation.tags).toEqual(['algorithms', 'python'])
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0]!.role).toBe('user')
    expect(result.messages[0]!.content).toBe('Hello')
    expect(result.messages[1]!.role).toBe('assistant')
    expect(result.messages[1]!.content).toBe('Hi there!')
  })

  it('should generate deterministic message IDs', () => {
    const conv = makeConversation()
    const messages = [
      makeMessage({ role: 'user', content: 'A' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content: 'B' }),
    ]

    const md = conversationToMarkdown(conv, messages, 1706002000000)
    const result = parseMarkdownExport(md)

    expect(result.messages[0]!.id).toBe('claude_abc123_msg_0000')
    expect(result.messages[1]!.id).toBe('claude_abc123_msg_0001')
  })

  it('should assign sequential createdAt timestamps', () => {
    const conv = makeConversation({ createdAt: 5000 })
    const messages = [
      makeMessage({ role: 'user', content: 'A' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content: 'B' }),
    ]

    const md = conversationToMarkdown(conv, messages, 1706002000000)
    const result = parseMarkdownExport(md)

    expect(result.messages[0]!.createdAt).toBe(5000)
    expect(result.messages[1]!.createdAt).toBe(6000)
  })

  it('should throw on missing frontmatter', () => {
    expect(() => parseMarkdownExport('no frontmatter')).toThrow()
  })

  it('should handle empty message body', () => {
    const conv = makeConversation()
    const md = conversationToMarkdown(conv, [], 1706002000000)
    const result = parseMarkdownExport(md)

    expect(result.messages).toHaveLength(0)
  })
})

// ============================================================================
// Full round-trip tests
// ============================================================================

describe('full round-trip', () => {
  it('should preserve conversation data through export → import cycle', () => {
    const conv = makeConversation({
      title: 'Test: special "chars" & more',
      tags: ['tag1', 'tag2'],
      isFavorite: true,
      favoriteAt: 1706000500000,
    })
    const messages = [
      makeMessage({ role: 'user', content: 'Question?' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content: 'Answer!' }),
      makeMessage({ id: 'msg-3', role: 'user', content: 'Follow-up' }),
    ]

    const md = conversationToMarkdown(conv, messages, 1706002000000)
    const result = parseMarkdownExport(md)

    expect(result.conversation.id).toBe(conv.id)
    expect(result.conversation.platform).toBe(conv.platform)
    expect(result.conversation.title).toBe(conv.title)
    expect(result.conversation.tags).toEqual(conv.tags)
    expect(result.conversation.isFavorite).toBe(true)
    expect(result.conversation.favoriteAt).toBe(1706000500000)
    expect(result.messages).toHaveLength(3)
    expect(result.messages[0]!.content).toBe('Question?')
    expect(result.messages[1]!.content).toBe('Answer!')
    expect(result.messages[2]!.content).toBe('Follow-up')
  })

  it('should handle CJK titles', () => {
    const conv = makeConversation({ title: '如何实现快速排序' })
    const messages = [makeMessage({ role: 'user', content: '请解释一下' })]

    const md = conversationToMarkdown(conv, messages, 1706002000000)
    const result = parseMarkdownExport(md)

    expect(result.conversation.title).toBe('如何实现快速排序')
    expect(result.messages[0]!.content).toBe('请解释一下')
  })

  it('should handle messages containing code blocks with ## headers', () => {
    const content = `Here is some code:

\`\`\`markdown
## This is a heading inside a code block
\`\`\`

And more text.`

    const conv = makeConversation()
    const messages = [
      makeMessage({ role: 'user', content: 'Show me markdown' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content }),
    ]

    const md = conversationToMarkdown(conv, messages, 1706002000000)
    const result = parseMarkdownExport(md)

    // The code block heading should NOT split the message
    expect(result.messages).toHaveLength(2)
    expect(result.messages[1]!.content).toContain('## This is a heading inside a code block')
  })

  it('should handle message with empty content', () => {
    const conv = makeConversation()
    const messages = [makeMessage({ role: 'user', content: '' })]

    const md = conversationToMarkdown(conv, messages, 1706002000000)
    const result = parseMarkdownExport(md)

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]!.content).toBe('')
  })

  it('should handle system messages', () => {
    const conv = makeConversation()
    const messages = [
      makeMessage({ role: 'system', content: 'You are a helpful assistant.' }),
      makeMessage({ id: 'msg-2', role: 'user', content: 'Hi' }),
    ]

    const md = conversationToMarkdown(conv, messages, 1706002000000)
    const result = parseMarkdownExport(md)

    expect(result.messages).toHaveLength(2)
    expect(result.messages[0]!.role).toBe('system')
    expect(result.messages[0]!.content).toBe('You are a helpful assistant.')
  })

  it('should preserve all platforms', () => {
    for (const platform of ['claude', 'chatgpt', 'gemini'] as const) {
      const conv = makeConversation({ platform, id: `${platform}_test` })
      const md = conversationToMarkdown(conv, [], 1706002000000)
      const result = parseMarkdownExport(md)
      expect(result.conversation.platform).toBe(platform)
    }
  })
})
