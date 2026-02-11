import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  formatDateForFilename,
  generateSafeFilename,
  isFileSizeSafe,
  formatFileSize,
  sha256,
  toJsonl,
  parseJsonl,
} from './utils'
import {
  exportData,
  exportConversations,
  exportToJson,
  exportToMarkdown,
  exportConversationToJson,
} from './export'
import type { Conversation, Message } from '@/types'
import * as db from '@/utils/db'
import JSZip from 'jszip'
import { z } from 'zod'

// ============================================================================
// Mocks for export functions
// ============================================================================

vi.mock('@/utils/db', () => ({
  getAllConversationsForExport: vi.fn().mockResolvedValue([]),
  getAllMessagesForExport: vi.fn().mockResolvedValue([]),
  getConversationById: vi.fn(),
  getMessagesByConversationId: vi.fn().mockResolvedValue([]),
  getSyncState: vi.fn().mockResolvedValue(null),
  initializeSyncState: vi.fn().mockResolvedValue({
    id: 'global',
    deviceId: 'test-device-123',
    lastPullAt: null,
    lastPushAt: null,
    remoteCursor: null,
    pendingConflicts: 0,
    status: 'idle',
    lastError: null,
    lastErrorAt: null,
  }),
}))

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ============================================================================
// Test Helpers
// ============================================================================

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    originalId: 'orig-1',
    platform: 'claude',
    title: 'Test Conversation',
    preview: 'Preview text',
    messageCount: 2,
    createdAt: 1000,
    updatedAt: 2000,
    url: 'https://claude.ai/chat/orig-1',
    isFavorite: false,
    favoriteAt: null,
    tags: [],
    syncedAt: 0,
    detailStatus: 'none',
    detailSyncedAt: null,
    ...overrides,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello',
    createdAt: 1000,
    ...overrides,
  }
}

// ============================================================================
// Utils Tests
// ============================================================================

describe('sync/utils', () => {
  describe('sha256', () => {
    it('should generate consistent hash for same input', async () => {
      const hash1 = await sha256('hello world')
      const hash2 = await sha256('hello world')
      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different input', async () => {
      const hash1 = await sha256('hello')
      const hash2 = await sha256('world')
      expect(hash1).not.toBe(hash2)
    })

    it('should generate 64 character hex string', async () => {
      const hash = await sha256('test')
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })
  })

  describe('toJsonl', () => {
    it('should convert array to JSONL format', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = toJsonl(items)
      expect(result).toBe('{"id":1}\n{"id":2}\n{"id":3}')
    })

    it('should handle empty array', () => {
      const result = toJsonl([])
      expect(result).toBe('')
    })

    it('should handle complex objects', () => {
      const items = [{ name: 'test', nested: { value: 123 } }]
      const result = toJsonl(items)
      expect(result).toBe('{"name":"test","nested":{"value":123}}')
    })
  })

  describe('parseJsonl', () => {
    const testSchema = z.object({
      id: z.number(),
      name: z.string(),
    })

    it('should parse valid JSONL content', () => {
      const content = '{"id":1,"name":"a"}\n{"id":2,"name":"b"}'
      const result = parseJsonl(content, testSchema)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: 1, name: 'a' })
      expect(result[1]).toEqual({ id: 2, name: 'b' })
    })

    it('should skip invalid lines and call onError', () => {
      const content = '{"id":1,"name":"a"}\ninvalid json\n{"id":2,"name":"b"}'
      const onError = vi.fn()
      const result = parseJsonl(content, testSchema, onError)
      expect(result).toHaveLength(2)
      expect(onError).toHaveBeenCalledWith(2, 'Invalid JSON')
    })

    it('should skip lines that fail validation', () => {
      const content = '{"id":1,"name":"a"}\n{"id":"invalid"}\n{"id":2,"name":"b"}'
      const onError = vi.fn()
      const result = parseJsonl(content, testSchema, onError)
      expect(result).toHaveLength(2)
      expect(onError).toHaveBeenCalledWith(2, 'Invalid data format')
    })

    it('should handle empty content', () => {
      const result = parseJsonl('', testSchema)
      expect(result).toHaveLength(0)
    })

    it('should handle content with empty lines', () => {
      const content = '{"id":1,"name":"a"}\n\n{"id":2,"name":"b"}\n'
      const result = parseJsonl(content, testSchema)
      expect(result).toHaveLength(2)
    })
  })

  describe('generateSafeFilename', () => {
    it('should generate filename with extension', () => {
      const result = generateSafeFilename('My Document', '.md')
      expect(result).toBe('My Document.md')
    })

    it('should remove filesystem-unsafe characters', () => {
      const result = generateSafeFilename('Hello: World?', '.txt')
      expect(result).toBe('Hello World.txt')
    })

    it('should truncate long titles', () => {
      const longTitle = 'a'.repeat(100)
      const result = generateSafeFilename(longTitle, '.md', 50)
      expect(result).toBe(`${'a'.repeat(50)}.md`)
    })

    it('should handle empty title', () => {
      const result = generateSafeFilename('', '.md')
      expect(result).toBe('untitled.md')
    })

    it('should handle title with only unsafe characters', () => {
      const result = generateSafeFilename('/:*?"<>|', '.md')
      expect(result).toBe('untitled.md')
    })
  })

  describe('isFileSizeSafe', () => {
    it('should return safe=true for small files', () => {
      const file = new File(['test'], 'test.txt')
      const result = isFileSizeSafe(file)
      expect(result.safe).toBe(true)
    })

    it('should return formatted size', () => {
      const file = new File(['test'], 'test.txt')
      const result = isFileSizeSafe(file)
      expect(result.sizeFormatted).toBe('4 B')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(2048)).toBe('2.0 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
    })

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
    })
  })

  describe('formatDateForFilename', () => {
    it('should format date correctly', () => {
      const date = new Date(2025, 0, 15, 10, 30, 45)
      const result = formatDateForFilename(date)
      expect(result).toBe('20250115_103045')
    })

    it('should pad single digits', () => {
      const date = new Date(2025, 0, 5, 5, 5, 5)
      const result = formatDateForFilename(date)
      expect(result).toBe('20250105_050505')
    })
  })
})

// ============================================================================
// Types Tests
// ============================================================================

describe('sync/types', () => {
  describe('createEmptyImportResult', () => {
    it('should create empty result with correct structure', async () => {
      const { createEmptyImportResult } = await import('./types')
      const result = createEmptyImportResult()

      expect(result.success).toBe(true)
      expect(result.imported.conversations).toBe(0)
      expect(result.imported.messages).toBe(0)
      expect(result.skipped.conversations).toBe(0)
      expect(result.skipped.messages).toBe(0)
      expect(result.conflicts).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('updateImportStats', () => {
    it('should increment imported count for conversations', async () => {
      const { createEmptyImportResult, updateImportStats } = await import('./types')
      const result = createEmptyImportResult()

      updateImportStats(result, 'imported', 'conversations')
      expect(result.imported.conversations).toBe(1)
    })

    it('should increment skipped count for messages', async () => {
      const { createEmptyImportResult, updateImportStats } = await import('./types')
      const result = createEmptyImportResult()

      updateImportStats(result, 'skipped', 'messages')
      expect(result.skipped.messages).toBe(1)
    })

    it('should not increment for conflict status', async () => {
      const { createEmptyImportResult, updateImportStats } = await import('./types')
      const result = createEmptyImportResult()

      updateImportStats(result, 'conflict', 'conversations')
      expect(result.imported.conversations).toBe(0)
      expect(result.skipped.conversations).toBe(0)
    })
  })

  describe('exportManifestSchema', () => {
    it('should validate correct manifest', async () => {
      const { exportManifestSchema } = await import('./types')

      const validManifest = {
        version: '1.0',
        exportedAt: Date.now(),
        deviceId: 'test-device',
        counts: { conversations: 10, messages: 100 },
        checksums: {
          'conversations.jsonl': 'abc123',
          'messages.jsonl': 'def456',
        },
        exportType: 'full' as const,
        sinceTimestamp: null,
        encrypted: false,
      }

      const result = exportManifestSchema.safeParse(validManifest)
      expect(result.success).toBe(true)
    })

    it('should reject invalid manifest', async () => {
      const { exportManifestSchema } = await import('./types')

      const invalidManifest = {
        version: '1.0',
        // missing required fields
      }

      const result = exportManifestSchema.safeParse(invalidManifest)
      expect(result.success).toBe(false)
    })
  })

  describe('exportManifestV2Schema', () => {
    it('should validate correct v2 manifest', async () => {
      const { exportManifestV2Schema } = await import('./types')

      const validManifest = {
        version: '2.0',
        format: 'markdown',
        exportedAt: Date.now(),
        counts: { conversations: 5, messages: 42 },
      }

      const result = exportManifestV2Schema.safeParse(validManifest)
      expect(result.success).toBe(true)
    })

    it('should reject v2 manifest with wrong version', async () => {
      const { exportManifestV2Schema } = await import('./types')

      const invalidManifest = {
        version: '1.0',
        format: 'markdown',
        exportedAt: Date.now(),
        counts: { conversations: 0, messages: 0 },
      }

      const result = exportManifestV2Schema.safeParse(invalidManifest)
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================================
// Export Function Tests
// ============================================================================

describe('export functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportData', () => {
    it('should export empty data as valid Markdown ZIP', async () => {
      const result = await exportData()

      expect(result.blob).toBeInstanceOf(Blob)
      expect(result.stats.conversations).toBe(0)
      expect(result.stats.messages).toBe(0)
      expect(result.filename).toContain('chatcentral_')
      expect(result.filename).toContain('0conv_0msg')
      expect(result.filename).toMatch(/\.zip$/)
    })

    it('should include manifest with v2 format', async () => {
      const result = await exportData()
      const zip = await JSZip.loadAsync(result.blob)
      const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))

      expect(manifest.version).toBe('2.0')
      expect(manifest.format).toBe('markdown')
      expect(manifest.counts).toEqual({ conversations: 0, messages: 0 })
    })

    it('should create platform subdirectories with .md files', async () => {
      vi.mocked(db.getAllConversationsForExport).mockResolvedValue([
        makeConversation({ id: 'c1', platform: 'claude', title: 'Claude Chat' }),
        makeConversation({ id: 'c2', platform: 'chatgpt', title: 'GPT Chat' }),
      ])
      vi.mocked(db.getMessagesByConversationId).mockImplementation(async (convId: string) => {
        if (convId === 'c1') return [makeMessage({ conversationId: 'c1' })]
        if (convId === 'c2') return [makeMessage({ id: 'msg-2', conversationId: 'c2' })]
        return []
      })

      const result = await exportData()
      const zip = await JSZip.loadAsync(result.blob)

      expect(zip.file('manifest.json')).toBeTruthy()
      // Check for platform subdirectories
      const files = Object.keys(zip.files).filter((f) => f.endsWith('.md'))
      expect(files).toHaveLength(2)
      expect(files.some((f) => f.startsWith('claude/'))).toBe(true)
      expect(files.some((f) => f.startsWith('chatgpt/'))).toBe(true)
    })

    it('should produce valid Markdown content with YAML frontmatter', async () => {
      vi.mocked(db.getAllConversationsForExport).mockResolvedValue([makeConversation()])
      vi.mocked(db.getMessagesByConversationId).mockResolvedValue([
        makeMessage({ role: 'user', content: 'Hello' }),
        makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hi!' }),
      ])

      const result = await exportData()
      const zip = await JSZip.loadAsync(result.blob)

      const mdFiles = Object.keys(zip.files).filter((f) => f.endsWith('.md'))
      expect(mdFiles).toHaveLength(1)

      const mdContent = await zip.file(mdFiles[0]!)!.async('string')
      expect(mdContent).toContain('---')
      expect(mdContent).toContain('id: conv-1')
      expect(mdContent).toContain('platform: claude')
      expect(mdContent).toContain('## User')
      expect(mdContent).toContain('Hello')
      expect(mdContent).toContain('## Assistant')
      expect(mdContent).toContain('Hi!')
    })

    it('should filter selected conversations', async () => {
      const c1 = makeConversation({ id: 'c1' })
      const c2 = makeConversation({ id: 'c2' })
      vi.mocked(db.getAllConversationsForExport).mockResolvedValue([c1, c2])
      vi.mocked(db.getMessagesByConversationId).mockResolvedValue([])

      const result = await exportData({ type: 'selected', conversationIds: ['c1'] })

      expect(result.stats.conversations).toBe(1)
    })

    it('should handle duplicate filenames within same platform', async () => {
      vi.mocked(db.getAllConversationsForExport).mockResolvedValue([
        makeConversation({ id: 'c1', title: 'Same Title' }),
        makeConversation({ id: 'c2', title: 'Same Title' }),
      ])
      vi.mocked(db.getMessagesByConversationId).mockResolvedValue([])

      const result = await exportData()
      const zip = await JSZip.loadAsync(result.blob)

      const mdFiles = Object.keys(zip.files).filter((f) => f.endsWith('.md'))
      expect(mdFiles).toHaveLength(2)
      // One should have _1 suffix
      expect(mdFiles.some((f) => f.includes('_1'))).toBe(true)
    })
  })

  describe('exportConversations', () => {
    it('should call exportData with selected type', async () => {
      vi.mocked(db.getAllConversationsForExport).mockResolvedValue([makeConversation({ id: 'c1' })])
      vi.mocked(db.getMessagesByConversationId).mockResolvedValue([])

      const result = await exportConversations(['c1'])

      expect(result.stats.conversations).toBe(1)
    })
  })

  describe('exportToJson', () => {
    it('should export as JSON blob with grouped messages', async () => {
      const c1 = makeConversation({ id: 'c1' })
      const c2 = makeConversation({ id: 'c2' })
      const m1 = makeMessage({ id: 'm1', conversationId: 'c1' })
      const m2 = makeMessage({ id: 'm2', conversationId: 'c2' })
      const m3 = makeMessage({ id: 'm3', conversationId: 'c1' })

      vi.mocked(db.getAllConversationsForExport).mockResolvedValue([c1, c2])
      vi.mocked(db.getMessagesByConversationId).mockImplementation(async (convId: string) => {
        if (convId === 'c1') return [m1, m3]
        if (convId === 'c2') return [m2]
        return []
      })

      const result = await exportToJson()

      expect(result.blob.type).toBe('application/json')
      expect(result.filename).toMatch(/\.json$/)

      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsText(result.blob)
      })
      const data = JSON.parse(text)
      expect(data.version).toBe('2.0')
      expect(data.conversations).toHaveLength(2)

      const conv1 = data.conversations.find((c: Record<string, unknown>) => c.id === 'c1')
      expect(conv1.messages).toHaveLength(2)
    })
  })

  describe('exportToMarkdown', () => {
    it('should export conversation with YAML frontmatter', async () => {
      vi.mocked(db.getConversationById).mockResolvedValue(makeConversation({ title: 'AI Chat' }))
      vi.mocked(db.getMessagesByConversationId).mockResolvedValue([
        makeMessage({ role: 'user', content: 'Hello!' }),
        makeMessage({ id: 'm2', role: 'assistant', content: 'Hi there!' }),
      ])

      const result = await exportToMarkdown('conv-1')

      expect(result.content).toContain('---')
      expect(result.content).toContain('title: AI Chat')
      expect(result.content).toContain('## User')
      expect(result.content).toContain('Hello!')
      expect(result.content).toContain('## Assistant')
      expect(result.content).toContain('Hi there!')
      expect(result.messageCount).toBe(2)
      expect(result.filename).toMatch(/\.md$/)
    })

    it('should throw when conversation not found', async () => {
      vi.mocked(db.getConversationById).mockResolvedValue(undefined)

      await expect(exportToMarkdown('missing')).rejects.toThrow('Conversation not found: missing')
    })
  })

  describe('exportConversationToJson', () => {
    it('should export single conversation as JSON', async () => {
      vi.mocked(db.getConversationById).mockResolvedValue(makeConversation({ title: 'Test' }))
      vi.mocked(db.getMessagesByConversationId).mockResolvedValue([makeMessage()])

      const result = await exportConversationToJson('conv-1')

      const data = JSON.parse(result.content)
      expect(data.version).toBe('2.0')
      expect(data.conversation.title).toBe('Test')
      expect(data.conversation.messages).toHaveLength(1)
      expect(result.filename).toMatch(/\.json$/)
    })

    it('should throw when conversation not found', async () => {
      vi.mocked(db.getConversationById).mockResolvedValue(undefined)

      await expect(exportConversationToJson('missing')).rejects.toThrow(
        'Conversation not found: missing'
      )
    })
  })
})
