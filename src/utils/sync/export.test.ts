import { describe, expect, it, vi } from 'vitest'
import {
  formatDateForFilename,
  generateSafeFilename,
  isFileSizeSafe,
  formatFileSize,
  sha256,
  toJsonl,
  parseJsonl,
} from './utils'
import { z } from 'zod'

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

    it('should remove special characters', () => {
      const result = generateSafeFilename('Hello! @#$% World', '.txt')
      expect(result).toBe('Hello  World.txt')
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

    it('should handle title with only special characters', () => {
      const result = generateSafeFilename('!@#$%', '.md')
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
})
