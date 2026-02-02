import { describe, expect, it, vi } from 'vitest'
import { validateImportFile } from './import'
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
      get: vi.fn(),
      add: vi.fn(),
      put: vi.fn(),
    },
    messages: {
      get: vi.fn(),
      add: vi.fn(),
      put: vi.fn(),
    },
    conflicts: {},
    transaction: vi.fn((_mode: string, _tables: unknown[], callback: () => void) => callback()),
  },
  addConflict: vi.fn(),
  invalidateSearchIndex: vi.fn(),
}))

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

    it('should validate ZIP file with manifest', async () => {
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
      expect(result.manifest?.version).toBe('1.0')
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

    it('should reject ZIP without data files', async () => {
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
})
