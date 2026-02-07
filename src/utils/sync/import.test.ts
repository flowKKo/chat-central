import { describe, expect, it, vi } from 'vitest'
import { importData, validateImportFile } from './import'
import { conversationToMarkdown } from './markdown'
import type { Conversation, Message } from '@/types'
import JSZip from 'jszip'

// Helper to create a mock File with text() method
function createMockFile(content: string | Blob, filename: string, type: string): File {
  const file = new File([content], filename, { type })
  // Add text() method for jsdom compatibility
  if (typeof content === 'string') {
    file.text = () => Promise.resolve(content)
  }
  return file
}

// Mock db module
vi.mock('@/utils/db', () => ({
  db: {
    conversations: {
      get: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
      put: vi.fn(),
    },
    messages: {
      get: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
      put: vi.fn(),
    },
    conflicts: {},
    transaction: vi.fn((_mode: string, _tables: unknown[], callback: () => void) => callback()),
  },
  addConflict: vi.fn(),
  invalidateSearchIndex: vi.fn(),
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
    id: 'claude_abc123',
    originalId: 'abc123',
    platform: 'claude',
    title: 'Test Conversation',
    preview: 'Preview text',
    messageCount: 2,
    createdAt: 1706000000000,
    updatedAt: 1706001000000,
    syncedAt: 1706001000000,
    isFavorite: false,
    favoriteAt: null,
    tags: [],
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
    content: 'Hello',
    createdAt: 1706000000000,
    ...overrides,
  }
}

async function createV2Zip(
  conversations: { conv: Conversation; messages: Message[] }[]
): Promise<Blob> {
  const zip = new JSZip()
  let totalMessages = 0

  for (const { conv, messages } of conversations) {
    const md = conversationToMarkdown(conv, messages, 1706002000000)
    zip.file(`${conv.platform}/${conv.title}.md`, md)
    totalMessages += messages.length
  }

  zip.file(
    'manifest.json',
    JSON.stringify({
      version: '2.0',
      format: 'markdown',
      exportedAt: 1706002000000,
      counts: {
        conversations: conversations.length,
        messages: totalMessages,
      },
    })
  )

  return zip.generateAsync({ type: 'blob' })
}

// ============================================================================
// Tests
// ============================================================================

describe('sync/import', () => {
  describe('validateImportFile', () => {
    it('should reject non-zip/json files', async () => {
      const file = createMockFile('test', 'test.txt', 'text/plain')
      const result = await validateImportFile(file)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.type).toBe('parse_error')
      expect(result.errors[0]!.message).toContain('.zip or .json')
    })

    it('should validate JSON file with correct structure', async () => {
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        conversations: [
          {
            id: 'test-1',
            title: 'Test Conversation',
            platform: 'claude',
          },
        ],
      }
      const jsonStr = JSON.stringify(data)
      const file = createMockFile(jsonStr, 'export.json', 'application/json')

      const result = await validateImportFile(file)

      expect(result.valid).toBe(true)
      expect(result.manifest).toBeDefined()
      expect(result.manifest?.counts.conversations).toBe(1)
    })

    it('should reject JSON file without conversations array', async () => {
      const data = { exportedAt: new Date().toISOString() }
      const file = createMockFile(JSON.stringify(data), 'export.json', 'application/json')

      const result = await validateImportFile(file)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.type).toBe('validation_error')
    })

    it('should reject invalid JSON', async () => {
      const file = createMockFile('not valid json', 'export.json', 'application/json')

      const result = await validateImportFile(file)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.type).toBe('parse_error')
    })

    it('should validate v1 ZIP file with manifest', async () => {
      const zip = new JSZip()
      const manifest = {
        version: '1.0',
        exportedAt: Date.now(),
        deviceId: 'test',
        counts: { conversations: 1, messages: 5 },
        checksums: {
          'conversations.jsonl': 'abc123',
          'messages.jsonl': 'def456',
        },
        exportType: 'full',
        sinceTimestamp: null,
        encrypted: false,
      }
      zip.file('manifest.json', JSON.stringify(manifest))
      zip.file('conversations.jsonl', '{}')
      zip.file('messages.jsonl', '{}')

      const blob = await zip.generateAsync({ type: 'blob' })
      const file = new File([blob], 'export.zip', { type: 'application/zip' })

      const result = await validateImportFile(file)
      expect(result.valid).toBe(true)
      expect(result.manifest).toBeDefined()
    })

    it('should validate v2 Markdown ZIP file', async () => {
      const blob = await createV2Zip([
        {
          conv: makeConversation(),
          messages: [makeMessage()],
        },
      ])
      const file = new File([blob], 'export.zip', { type: 'application/zip' })

      const result = await validateImportFile(file)
      expect(result.valid).toBe(true)
      expect(result.manifest).toBeDefined()
      expect((result.manifest as Record<string, unknown>).format).toBe('markdown')
    })

    it('should reject ZIP without manifest', async () => {
      const zip = new JSZip()
      zip.file('conversations.jsonl', '{}')

      const blob = await zip.generateAsync({ type: 'blob' })
      const file = new File([blob], 'export.zip', { type: 'application/zip' })

      const result = await validateImportFile(file)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.message).toContain('manifest.json')
    })

    it('should reject ZIP with unsupported version', async () => {
      const zip = new JSZip()
      const manifest = {
        version: '99.0',
        exportedAt: Date.now(),
        deviceId: 'test',
        counts: { conversations: 0, messages: 0 },
        checksums: {
          'conversations.jsonl': '',
          'messages.jsonl': '',
        },
        exportType: 'full',
        sinceTimestamp: null,
        encrypted: false,
      }
      zip.file('manifest.json', JSON.stringify(manifest))
      zip.file('conversations.jsonl', '')
      zip.file('messages.jsonl', '')

      const blob = await zip.generateAsync({ type: 'blob' })
      const file = new File([blob], 'export.zip', { type: 'application/zip' })

      const result = await validateImportFile(file)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.type).toBe('version_incompatible')
    })

    it('should reject v1 ZIP without data files', async () => {
      const zip = new JSZip()
      const manifest = {
        version: '1.0',
        exportedAt: Date.now(),
        deviceId: 'test',
        counts: { conversations: 0, messages: 0 },
        checksums: {
          'conversations.jsonl': '',
          'messages.jsonl': '',
        },
        exportType: 'full',
        sinceTimestamp: null,
        encrypted: false,
      }
      zip.file('manifest.json', JSON.stringify(manifest))
      // Missing conversations.jsonl and messages.jsonl

      const blob = await zip.generateAsync({ type: 'blob' })
      const file = new File([blob], 'export.zip', { type: 'application/zip' })

      const result = await validateImportFile(file)
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.message).toContain('Missing data files')
    })
  })

  describe('importData - v2 Markdown format', () => {
    it('should import conversations from Markdown ZIP', async () => {
      const conv = makeConversation()
      const messages = [
        makeMessage({ role: 'user', content: 'Hello' }),
        makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hi!' }),
      ]
      const blob = await createV2Zip([{ conv, messages }])
      const file = new File([blob], 'export.zip', { type: 'application/zip' })

      const result = await importData(file)

      expect(result.success).toBe(true)
      expect(result.imported.conversations).toBe(1)
      expect(result.imported.messages).toBe(2)
    })

    it('should handle ZIP with no .md files', async () => {
      const zip = new JSZip()
      zip.file(
        'manifest.json',
        JSON.stringify({
          version: '2.0',
          format: 'markdown',
          exportedAt: Date.now(),
          counts: { conversations: 0, messages: 0 },
        })
      )

      const blob = await zip.generateAsync({ type: 'blob' })
      const file = new File([blob], 'export.zip', { type: 'application/zip' })

      const result = await importData(file)
      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.message.includes('No .md files'))).toBe(true)
    })

    it('should auto-detect format and import', async () => {
      const conv = makeConversation({ title: 'Auto Detect' })
      const blob = await createV2Zip([{ conv, messages: [] }])
      const file = new File([blob], 'export.zip', { type: 'application/zip' })

      const result = await importData(file)

      expect(result.success).toBe(true)
      expect(result.imported.conversations).toBe(1)
    })
  })
})
