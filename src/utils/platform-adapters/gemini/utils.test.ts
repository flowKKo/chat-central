import { describe, expect, it } from 'vitest'
import {
  findTimestampInArray,
  isConversationId,
  isResponseId,
  isStringArray,
  normalizeConversationId,
  walk,
} from './utils'

describe('gemini utils', () => {
  describe('normalizeConversationId', () => {
    it('should remove c_ prefix', () => {
      expect(normalizeConversationId('c_abc123')).toBe('abc123')
    })

    it('should return ID unchanged if no c_ prefix', () => {
      expect(normalizeConversationId('abc123')).toBe('abc123')
    })

    it('should only remove prefix at the start', () => {
      expect(normalizeConversationId('abc_c_123')).toBe('abc_c_123')
    })

    it('should handle empty string', () => {
      expect(normalizeConversationId('')).toBe('')
    })
  })

  describe('isConversationId', () => {
    it('should return true for valid conversation IDs', () => {
      expect(isConversationId('c_abc123')).toBe(true)
      expect(isConversationId('c_ABC123')).toBe(true)
      expect(isConversationId('c_a1b2c3')).toBe(true)
    })

    it('should return false for invalid conversation IDs', () => {
      expect(isConversationId('abc123')).toBe(false) // missing c_ prefix
      expect(isConversationId('c_')).toBe(false) // empty after prefix
      expect(isConversationId('c_abc-123')).toBe(false) // invalid char
      expect(isConversationId('c_abc 123')).toBe(false) // space
    })

    it('should return false for non-strings', () => {
      expect(isConversationId(null)).toBe(false)
      expect(isConversationId(undefined)).toBe(false)
      expect(isConversationId(123)).toBe(false)
      expect(isConversationId({ id: 'c_abc' })).toBe(false)
    })
  })

  describe('isResponseId', () => {
    it('should return true for rc_ format', () => {
      expect(isResponseId('rc_abc123')).toBe(true)
      expect(isResponseId('rc_ABC123')).toBe(true)
    })

    it('should return true for r_ format', () => {
      expect(isResponseId('r_abc123')).toBe(true)
      expect(isResponseId('r_ABC123')).toBe(true)
    })

    it('should return false for invalid response IDs', () => {
      expect(isResponseId('abc123')).toBe(false) // no prefix
      expect(isResponseId('c_abc123')).toBe(false) // wrong prefix
      expect(isResponseId('rc_')).toBe(false) // empty after prefix
      expect(isResponseId('r_abc-123')).toBe(false) // invalid char
    })

    it('should return false for non-strings', () => {
      expect(isResponseId(null)).toBe(false)
      expect(isResponseId(undefined)).toBe(false)
      expect(isResponseId(123)).toBe(false)
    })
  })

  describe('isStringArray', () => {
    it('should return true for array of strings', () => {
      expect(isStringArray(['a', 'b', 'c'])).toBe(true)
      expect(isStringArray([])).toBe(true) // empty array is valid
      expect(isStringArray([''])).toBe(true) // empty string is still string
    })

    it('should return false for mixed arrays', () => {
      expect(isStringArray(['a', 1, 'b'])).toBe(false)
      expect(isStringArray(['a', null, 'b'])).toBe(false)
      expect(isStringArray(['a', undefined, 'b'])).toBe(false)
    })

    it('should return false for non-arrays', () => {
      expect(isStringArray('string')).toBe(false)
      expect(isStringArray(null)).toBe(false)
      expect(isStringArray({ 0: 'a', 1: 'b' })).toBe(false)
    })
  })

  describe('findTimestampInArray', () => {
    it('should find max timestamp', () => {
      const arr = [1609459200000, 1609545600000, 1609372800000]
      expect(findTimestampInArray(arr)).toBe(1609545600000)
    })

    it('should return null for empty array', () => {
      expect(findTimestampInArray([])).toBeNull()
    })

    it('should skip invalid values', () => {
      const arr = ['invalid', 1609459200000, null]
      expect(findTimestampInArray(arr)).toBe(1609459200000)
    })
  })

  describe('walk', () => {
    it('should call object handler for objects', () => {
      const visited: Record<string, unknown>[] = []
      walk(
        { a: 1, b: { c: 2 } },
        {
          object: (obj) => {
            visited.push(obj)
            return false // continue walking
          },
        }
      )
      expect(visited.length).toBeGreaterThan(0)
      expect(visited[0]).toEqual({ a: 1, b: { c: 2 } })
    })

    it('should call array handler for arrays', () => {
      const visited: unknown[][] = []
      walk([1, [2, 3], 4], {
        array: (arr) => {
          visited.push(arr)
          return false
        },
      })
      expect(visited.length).toBeGreaterThan(0)
      expect(visited[0]).toEqual([1, [2, 3], 4])
    })

    it('should call string handler for strings', () => {
      const visited: string[] = []
      walk(
        { a: 'hello', b: 'world' },
        {
          string: (str) => {
            visited.push(str)
            return false
          },
        }
      )
      expect(visited).toContain('hello')
      expect(visited).toContain('world')
    })

    it('should skip children when handler returns true', () => {
      const visited: string[] = []
      walk(
        { a: 'top', nested: { b: 'child' } },
        {
          object: () => true, // skip
          string: (str) => {
            visited.push(str)
            return false
          },
        }
      )
      expect(visited).toHaveLength(0)
    })

    it('should parse JSON strings', () => {
      const visited: unknown[] = []
      walk('{"nested": true}', {
        object: (obj) => {
          visited.push(obj)
          return false
        },
      })
      expect(visited).toContainEqual({ nested: true })
    })

    it('should handle null/undefined gracefully', () => {
      expect(() => walk(null, {})).not.toThrow()
      expect(() => walk(undefined, {})).not.toThrow()
    })

    it('should walk nested structures recursively', () => {
      const strings: string[] = []
      walk(
        {
          level1: {
            level2: {
              value: 'deep',
            },
          },
        },
        {
          string: (str) => {
            strings.push(str)
            return false
          },
        }
      )
      expect(strings).toContain('deep')
    })

    it('should walk array items', () => {
      const strings: string[] = []
      walk(['a', 'b', ['c', 'd']], {
        string: (str) => {
          strings.push(str)
          return false
        },
      })
      expect(strings).toEqual(['a', 'b', 'c', 'd'])
    })
  })
})
