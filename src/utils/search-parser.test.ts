import { describe, it, expect } from 'vitest'
import { parseSearchQuery, hasOperators, formatParsedQuery } from './search-parser'
import { endOfDay, parseDateString } from './date'

describe('parseSearchQuery', () => {
  it('should parse plain text query', () => {
    const result = parseSearchQuery('hello world')
    expect(result.freeText).toBe('hello world')
    expect(result.operators).toEqual({})
  })

  it('should parse platform operator', () => {
    const result = parseSearchQuery('platform:claude hello')
    expect(result.freeText).toBe('hello')
    expect(result.operators.platform).toBe('claude')
  })

  it('should parse platform operator case-insensitively', () => {
    const result = parseSearchQuery('Platform:ChatGPT test')
    expect(result.freeText).toBe('test')
    expect(result.operators.platform).toBe('chatgpt')
  })

  it('should parse single tag operator', () => {
    const result = parseSearchQuery('tag:work hello')
    expect(result.freeText).toBe('hello')
    expect(result.operators.tags).toEqual(['work'])
  })

  it('should parse multiple tag operators', () => {
    const result = parseSearchQuery('tag:work tag:project hello tag:important')
    expect(result.freeText).toBe('hello')
    expect(result.operators.tags).toEqual(['work', 'project', 'important'])
  })

  it('should parse before operator', () => {
    const result = parseSearchQuery('before:2024-01-15 hello')
    expect(result.freeText).toBe('hello')
    // Should be end of day (23:59:59.999)
    const expectedTs = parseDateString('2024-01-15')!
    expect(result.operators.before).toBe(endOfDay(expectedTs))
  })

  it('should parse after operator', () => {
    const result = parseSearchQuery('after:2024-01-01 hello')
    expect(result.freeText).toBe('hello')
    expect(result.operators.after).toBe(parseDateString('2024-01-01'))
  })

  it('should parse is:favorite operator', () => {
    const result = parseSearchQuery('is:favorite hello')
    expect(result.freeText).toBe('hello')
    expect(result.operators.isFavorite).toBe(true)
  })

  it('should parse multiple operators together', () => {
    const result = parseSearchQuery('platform:claude tag:work before:2024-01-01 hello world')
    expect(result.freeText).toBe('hello world')
    expect(result.operators.platform).toBe('claude')
    expect(result.operators.tags).toEqual(['work'])
    expect(result.operators.before).toBeDefined()
  })

  it('should handle operators with no free text', () => {
    const result = parseSearchQuery('platform:gemini tag:test')
    expect(result.freeText).toBe('')
    expect(result.operators.platform).toBe('gemini')
    expect(result.operators.tags).toEqual(['test'])
  })

  it('should handle empty query', () => {
    const result = parseSearchQuery('')
    expect(result.freeText).toBe('')
    expect(result.operators).toEqual({})
  })

  it('should handle whitespace-only query', () => {
    const result = parseSearchQuery('   ')
    expect(result.freeText).toBe('')
    expect(result.operators).toEqual({})
  })

  it('should collapse multiple spaces in free text', () => {
    const result = parseSearchQuery('hello    world')
    expect(result.freeText).toBe('hello world')
  })

  it('should ignore invalid platform values', () => {
    const result = parseSearchQuery('platform:invalid hello')
    expect(result.freeText).toBe('platform:invalid hello')
    expect(result.operators.platform).toBeUndefined()
  })

  it('should ignore invalid date formats', () => {
    const result = parseSearchQuery('before:invalid hello')
    expect(result.freeText).toBe('before:invalid hello')
    expect(result.operators.before).toBeUndefined()
  })
})

describe('hasOperators', () => {
  it('should return true for queries with operators', () => {
    expect(hasOperators('platform:claude')).toBe(true)
    expect(hasOperators('tag:work hello')).toBe(true)
    expect(hasOperators('before:2024-01-01')).toBe(true)
    expect(hasOperators('after:2024-01-01')).toBe(true)
    expect(hasOperators('is:favorite')).toBe(true)
  })

  it('should return false for plain text queries', () => {
    expect(hasOperators('hello world')).toBe(false)
    expect(hasOperators('')).toBe(false)
    expect(hasOperators('platformclaude')).toBe(false)
  })
})

describe('formatParsedQuery', () => {
  it('should format parsed query back to string', () => {
    const parsed = parseSearchQuery('platform:claude tag:work hello')
    const formatted = formatParsedQuery(parsed)
    expect(formatted).toContain('platform:claude')
    expect(formatted).toContain('tag:work')
    expect(formatted).toContain('hello')
  })

  it('should handle empty operators', () => {
    const parsed = parseSearchQuery('hello world')
    const formatted = formatParsedQuery(parsed)
    expect(formatted).toBe('hello world')
  })
})
