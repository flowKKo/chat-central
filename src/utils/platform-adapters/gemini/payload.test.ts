import { describe, it, expect } from 'vitest'
import { normalizePayloads, extractWrbPayloads, getPayloadSources } from './payload'

describe('normalizePayloads', () => {
  it('should wrap array data into a single-element array', () => {
    const data = [1, 2, 3]
    const result = normalizePayloads(data)
    expect(result).toEqual([[1, 2, 3]])
  })

  it('should wrap object data into a single-element array', () => {
    const data = { key: 'value' }
    const result = normalizePayloads(data)
    expect(result).toEqual([{ key: 'value' }])
  })

  it('should parse JSON string input', () => {
    const data = JSON.stringify({ key: 'value' })
    const result = normalizePayloads(data)
    expect(result).toEqual([{ key: 'value' }])
  })

  it('should strip XSSI prefix before parsing', () => {
    const data = `)]}'
[1, 2, 3]`
    const result = normalizePayloads(data)
    expect(result).toEqual([[1, 2, 3]])
  })

  it('should return empty array for non-string primitives', () => {
    expect(normalizePayloads(123)).toEqual([])
    expect(normalizePayloads(true)).toEqual([])
    expect(normalizePayloads(undefined)).toEqual([])
  })

  it('should return empty array for empty string', () => {
    expect(normalizePayloads('')).toEqual([])
  })

  it('should return empty array for invalid JSON string', () => {
    expect(normalizePayloads('not json at all')).toEqual([])
  })

  it('should handle multi-line JSON responses', () => {
    const data = '{"a":1}\n{"b":2}'
    const result = normalizePayloads(data)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })
})

describe('extractWrbPayloads', () => {
  it('should extract parsed content from wrb.fr arrays', () => {
    const payloads = [['wrb.fr', 'methodName', JSON.stringify({ data: 'test' }), null]]
    const result = extractWrbPayloads(payloads)
    expect(result).toEqual([{ data: 'test' }])
  })

  it('should handle nested wrb.fr arrays', () => {
    const payloads = [
      [
        ['wrb.fr', 'method1', JSON.stringify([1, 2]), null],
        ['wrb.fr', 'method2', JSON.stringify({ key: 'val' }), null],
      ],
    ]
    const result = extractWrbPayloads(payloads)
    expect(result).toEqual([[1, 2], { key: 'val' }])
  })

  it('should return empty array when no wrb.fr entries found', () => {
    const payloads = [{ simple: 'object' }]
    const result = extractWrbPayloads(payloads)
    expect(result).toEqual([])
  })

  it('should skip wrb.fr entries with invalid JSON', () => {
    const payloads = [['wrb.fr', 'method', 'not-json', null]]
    const result = extractWrbPayloads(payloads)
    expect(result).toEqual([])
  })

  it('should skip arrays that look like wrb.fr but have wrong length', () => {
    const payloads = [['wrb.fr', 'only-two-elements']]
    const result = extractWrbPayloads(payloads)
    expect(result).toEqual([])
  })

  it('should skip wrb.fr entries where third element is not a string', () => {
    const payloads = [['wrb.fr', 'method', 123, null]]
    const result = extractWrbPayloads(payloads)
    expect(result).toEqual([])
  })

  it('should recursively parse string values that look like JSON', () => {
    const inner = JSON.stringify(['wrb.fr', 'inner', JSON.stringify({ deep: true }), null])
    const payloads = [inner]
    const result = extractWrbPayloads(payloads)
    expect(result).toEqual([{ deep: true }])
  })

  it('should handle null and undefined in payloads', () => {
    const payloads = [null, undefined, '', 0]
    const result = extractWrbPayloads(payloads)
    expect(result).toEqual([])
  })
})

describe('getPayloadSources', () => {
  it('should return wrb payloads when available', () => {
    const data = [['wrb.fr', 'method', JSON.stringify({ extracted: true }), null]]
    const result = getPayloadSources(data)
    expect(result).toEqual([{ extracted: true }])
  })

  it('should fall back to normalized payloads when no wrb payloads found', () => {
    const data = { regular: 'object' }
    const result = getPayloadSources(data)
    expect(result).toEqual([{ regular: 'object' }])
  })

  it('should return empty array for invalid input', () => {
    expect(getPayloadSources(null)).toEqual([])
  })
})
