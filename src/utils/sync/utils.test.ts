import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sha256,
  toJsonl,
  parseJsonl,
  generateSafeFilename,
  isFileSizeSafe,
  formatFileSize,
  formatDateForFilename,
  MAX_IMPORT_FILE_SIZE,
  downloadBlob,
} from './utils'

describe('sync/utils', () => {
  describe('sha256', () => {
    it('should hash empty string', async () => {
      const hash = await sha256('')
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })

    it('should hash simple string', async () => {
      const hash = await sha256('hello')
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    })

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await sha256('hello')
      const hash2 = await sha256('world')
      expect(hash1).not.toBe(hash2)
    })

    it('should produce consistent hashes', async () => {
      const hash1 = await sha256('test')
      const hash2 = await sha256('test')
      expect(hash1).toBe(hash2)
    })
  })

  describe('toJsonl', () => {
    it('should convert empty array', () => {
      expect(toJsonl([])).toBe('')
    })

    it('should convert single item', () => {
      const result = toJsonl([{ id: 1, name: 'test' }])
      expect(result).toBe('{"id":1,"name":"test"}')
    })

    it('should convert multiple items with newlines', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = toJsonl(items)
      expect(result).toBe('{"id":1}\n{"id":2}\n{"id":3}')
    })

    it('should handle complex objects', () => {
      const items = [{ nested: { value: [1, 2, 3] } }]
      const result = toJsonl(items)
      expect(result).toBe('{"nested":{"value":[1,2,3]}}')
    })
  })

  describe('parseJsonl', () => {
    const mockSchema = {
      safeParse: (data: unknown) => {
        if (data && typeof data === 'object' && 'id' in data) {
          return { success: true, data: data as { id: number } }
        }
        return { success: false, error: 'Invalid' }
      },
    }

    it('should parse empty string', () => {
      const result = parseJsonl('', mockSchema)
      expect(result).toEqual([])
    })

    it('should parse single line', () => {
      const result = parseJsonl('{"id":1}', mockSchema)
      expect(result).toEqual([{ id: 1 }])
    })

    it('should parse multiple lines', () => {
      const content = '{"id":1}\n{"id":2}\n{"id":3}'
      const result = parseJsonl(content, mockSchema)
      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    })

    it('should skip invalid JSON lines', () => {
      const errors: Array<{ line: number; message: string }> = []
      const content = '{"id":1}\ninvalid json\n{"id":3}'
      const result = parseJsonl(content, mockSchema, (line, msg) => {
        errors.push({ line, message: msg })
      })
      expect(result).toEqual([{ id: 1 }, { id: 3 }])
      expect(errors).toHaveLength(1)
      expect(errors[0]!.line).toBe(2)
      expect(errors[0]!.message).toBe('Invalid JSON')
    })

    it('should skip lines that fail schema validation', () => {
      const errors: Array<{ line: number; message: string }> = []
      const content = '{"id":1}\n{"invalid":"data"}\n{"id":3}'
      const result = parseJsonl(content, mockSchema, (line, msg) => {
        errors.push({ line, message: msg })
      })
      expect(result).toEqual([{ id: 1 }, { id: 3 }])
      expect(errors).toHaveLength(1)
      expect(errors[0]!.message).toBe('Invalid data format')
    })

    it('should handle empty lines', () => {
      const content = '{"id":1}\n\n{"id":2}\n   \n{"id":3}'
      const result = parseJsonl(content, mockSchema)
      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    })
  })

  describe('generateSafeFilename', () => {
    it('should keep simple filenames', () => {
      expect(generateSafeFilename('test', '.json')).toBe('test.json')
    })

    it('should remove special characters', () => {
      expect(generateSafeFilename('test/file:name?', '.txt')).toBe('testfilename.txt')
    })

    it('should handle empty title', () => {
      expect(generateSafeFilename('', '.json')).toBe('untitled.json')
    })

    it('should handle title with only special chars', () => {
      expect(generateSafeFilename('!@#$%', '.md')).toBe('untitled.md')
    })

    it('should truncate long filenames', () => {
      const longTitle = 'a'.repeat(100)
      const result = generateSafeFilename(longTitle, '.json')
      expect(result).toBe(`${'a'.repeat(50)}.json`)
    })

    it('should respect custom max length', () => {
      const title = 'a'.repeat(30)
      const result = generateSafeFilename(title, '.json', 10)
      expect(result).toBe(`${'a'.repeat(10)}.json`)
    })

    it('should preserve hyphens and underscores', () => {
      expect(generateSafeFilename('test-file_name', '.txt')).toBe('test-file_name.txt')
    })

    it('should preserve spaces', () => {
      expect(generateSafeFilename('test file name', '.txt')).toBe('test file name.txt')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
    })

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
      expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB')
    })
  })

  describe('isFileSizeSafe', () => {
    it('should accept files under limit', () => {
      const file = new File(['test'], 'test.json', { type: 'application/json' })
      const result = isFileSizeSafe(file)
      expect(result.safe).toBe(true)
    })

    it('should reject files over limit', () => {
      // Create a mock file with size over 100MB
      const mockFile = {
        size: MAX_IMPORT_FILE_SIZE + 1,
        name: 'large.json',
      } as File

      const result = isFileSizeSafe(mockFile)
      expect(result.safe).toBe(false)
    })

    it('should return formatted size', () => {
      const file = new File(['x'.repeat(1024)], 'test.json')
      const result = isFileSizeSafe(file)
      expect(result.sizeFormatted).toBe('1.0 KB')
    })
  })

  describe('formatDateForFilename', () => {
    it('should format date correctly', () => {
      const date = new Date(2024, 0, 15, 10, 30, 45) // Jan 15, 2024 10:30:45
      expect(formatDateForFilename(date)).toBe('20240115_103045')
    })

    it('should pad single digits', () => {
      const date = new Date(2024, 0, 5, 5, 5, 5) // Jan 5, 2024 05:05:05
      expect(formatDateForFilename(date)).toBe('20240105_050505')
    })

    it('should handle end of year', () => {
      const date = new Date(2024, 11, 31, 23, 59, 59) // Dec 31, 2024 23:59:59
      expect(formatDateForFilename(date)).toBe('20241231_235959')
    })
  })

  describe('downloadBlob', () => {
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL

    beforeEach(() => {
      // Mock URL methods that may not exist in jsdom
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test')
      URL.revokeObjectURL = vi.fn()
    })

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
      vi.restoreAllMocks()
    })

    it('should create and click download link', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const clickSpy = vi.fn()

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickSpy,
      } as unknown as HTMLAnchorElement)
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)

      const result = downloadBlob(blob, 'test.txt')

      expect(result).toBe(true)
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
      expect(clickSpy).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
    })

    it('should return false on error', () => {
      URL.createObjectURL = vi.fn().mockImplementation(() => {
        throw new Error('Failed')
      })

      const blob = new Blob(['test'])
      const result = downloadBlob(blob, 'test.txt')

      expect(result).toBe(false)
    })
  })

  describe('mAX_IMPORT_FILE_SIZE', () => {
    it('should be 100MB', () => {
      expect(MAX_IMPORT_FILE_SIZE).toBe(100 * 1024 * 1024)
    })
  })
})
