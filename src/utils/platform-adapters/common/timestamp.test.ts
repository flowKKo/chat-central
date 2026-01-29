import { describe, expect, it } from 'vitest'
import {
  findMaxTimestampInArray,
  parseDate,
  readTimestampFromObject,
  toEpochMillis,
  toEpochMillisWithFallback,
} from './timestamp'

describe('timestamp utilities', () => {
  describe('toEpochMillis', () => {
    describe('array format [seconds, nanos]', () => {
      it('should convert [seconds, nanos] array to milliseconds', () => {
        // 1609459200 = 2021-01-01 00:00:00 UTC
        const result = toEpochMillis([1609459200, 500000000])
        expect(result).toBe(1609459200000 + 500) // seconds * 1000 + nanos / 1e6
      })

      it('should handle zero nanos', () => {
        const result = toEpochMillis([1609459200, 0])
        expect(result).toBe(1609459200000)
      })

      it('should return null for non-number array elements', () => {
        expect(toEpochMillis(['1609459200', 0])).toBeNull()
        expect(toEpochMillis([1609459200, '0'])).toBeNull()
      })

      it('should return null for seconds out of range', () => {
        expect(toEpochMillis([100, 0])).toBeNull() // too small
        expect(toEpochMillis([1e12, 0])).toBeNull() // too large
      })

      it('should return null for wrong array length', () => {
        expect(toEpochMillis([1609459200])).toBeNull()
        expect(toEpochMillis([1609459200, 0, 0])).toBeNull()
      })
    })

    describe('numeric timestamps', () => {
      it('should return milliseconds as-is for 13-digit numbers', () => {
        const ts = 1609459200000
        expect(toEpochMillis(ts)).toBe(ts)
      })

      it('should convert seconds to milliseconds for 10-digit numbers', () => {
        const seconds = 1609459200
        expect(toEpochMillis(seconds)).toBe(seconds * 1000)
      })

      it('should return null for small numbers', () => {
        expect(toEpochMillis(1000)).toBeNull()
        expect(toEpochMillis(0)).toBeNull()
      })
    })

    describe('iSO date strings', () => {
      it('should parse ISO date string', () => {
        const isoDate = '2021-01-01T00:00:00.000Z'
        const result = toEpochMillis(isoDate)
        expect(result).toBe(new Date(isoDate).getTime())
      })

      it('should parse date-only string', () => {
        const dateStr = '2021-01-01'
        const result = toEpochMillis(dateStr)
        expect(result).not.toBeNull()
        expect(result).toBe(new Date(dateStr).getTime())
      })

      it('should return null for invalid date string', () => {
        expect(toEpochMillis('not a date')).toBeNull()
        expect(toEpochMillis('')).toBeNull()
      })
    })

    describe('edge cases', () => {
      it('should return null for null/undefined', () => {
        expect(toEpochMillis(null)).toBeNull()
        expect(toEpochMillis(undefined)).toBeNull()
      })

      it('should return null for objects', () => {
        expect(toEpochMillis({ time: 123 })).toBeNull()
      })

      it('should return null for boolean', () => {
        expect(toEpochMillis(true)).toBeNull()
        expect(toEpochMillis(false)).toBeNull()
      })
    })
  })

  describe('readTimestampFromObject', () => {
    it('should read from timestamp field', () => {
      const obj = { timestamp: 1609459200000 }
      expect(readTimestampFromObject(obj)).toBe(1609459200000)
    })

    it('should read from createTime field', () => {
      const obj = { createTime: 1609459200000 }
      expect(readTimestampFromObject(obj)).toBe(1609459200000)
    })

    it('should read from create_time field', () => {
      const obj = { create_time: 1609459200000 }
      expect(readTimestampFromObject(obj)).toBe(1609459200000)
    })

    it('should read from created_at field', () => {
      const obj = { created_at: '2021-01-01T00:00:00.000Z' }
      expect(readTimestampFromObject(obj)).not.toBeNull()
    })

    it('should read from createdAt field', () => {
      const obj = { createdAt: 1609459200000 }
      expect(readTimestampFromObject(obj)).toBe(1609459200000)
    })

    it('should read from time field', () => {
      const obj = { time: 1609459200000 }
      expect(readTimestampFromObject(obj)).toBe(1609459200000)
    })

    it('should read from ct field', () => {
      const obj = { ct: 1609459200000 }
      expect(readTimestampFromObject(obj)).toBe(1609459200000)
    })

    it('should prioritize candidates in order', () => {
      // Use values > 1e12 to be treated as milliseconds directly
      const obj = { timestamp: 1609459200000, create_time: 1709459200000 }
      expect(readTimestampFromObject(obj)).toBe(1609459200000)
    })

    it('should handle [seconds, nanos] format', () => {
      const obj = { createTime: [1609459200, 0] }
      expect(readTimestampFromObject(obj)).toBe(1609459200000)
    })

    it('should return null if no timestamp field found', () => {
      const obj = { id: '123', name: 'test' }
      expect(readTimestampFromObject(obj)).toBeNull()
    })

    it('should return null for invalid timestamp values', () => {
      const obj = { timestamp: 'invalid' }
      expect(readTimestampFromObject(obj)).toBeNull()
    })
  })

  describe('findMaxTimestampInArray', () => {
    it('should find maximum timestamp in array', () => {
      const arr = [1609459200000, 1609545600000, 1609372800000]
      expect(findMaxTimestampInArray(arr)).toBe(1609545600000)
    })

    it('should handle mixed formats', () => {
      const arr = [
        1609459200000, // milliseconds
        1609545600, // seconds (will be converted)
        '2021-01-03T00:00:00.000Z',
      ]
      const result = findMaxTimestampInArray(arr)
      expect(result).not.toBeNull()
      // January 3rd should be the latest
      expect(result).toBeGreaterThan(1609459200000)
    })

    it('should skip invalid values', () => {
      const arr = ['invalid', null, 1609459200000, undefined, 'not a date']
      expect(findMaxTimestampInArray(arr)).toBe(1609459200000)
    })

    it('should return null for empty array', () => {
      expect(findMaxTimestampInArray([])).toBeNull()
    })

    it('should return null for array with no valid timestamps', () => {
      const arr = ['invalid', null, {}, undefined]
      expect(findMaxTimestampInArray(arr)).toBeNull()
    })

    it('should handle single element array', () => {
      expect(findMaxTimestampInArray([1609459200000])).toBe(1609459200000)
    })
  })

  describe('toEpochMillisWithFallback', () => {
    const fallback = 9999

    it('should return milliseconds for 13-digit number', () => {
      expect(toEpochMillisWithFallback(1609459200000, fallback)).toBe(1609459200000)
    })

    it('should convert seconds to milliseconds for 10-digit number', () => {
      expect(toEpochMillisWithFallback(1609459200, fallback)).toBe(1609459200000)
    })

    it('should parse ISO date string', () => {
      const iso = '2021-01-01T00:00:00.000Z'
      expect(toEpochMillisWithFallback(iso, fallback)).toBe(new Date(iso).getTime())
    })

    it('should return fallback for null', () => {
      expect(toEpochMillisWithFallback(null, fallback)).toBe(fallback)
    })

    it('should return fallback for undefined', () => {
      expect(toEpochMillisWithFallback(undefined, fallback)).toBe(fallback)
    })

    it('should return fallback for invalid string', () => {
      expect(toEpochMillisWithFallback('not-a-date', fallback)).toBe(fallback)
    })

    it('should return fallback for small number', () => {
      expect(toEpochMillisWithFallback(42, fallback)).toBe(fallback)
    })

    it('should return fallback for boolean', () => {
      expect(toEpochMillisWithFallback(true, fallback)).toBe(fallback)
    })

    it('should handle [seconds, nanos] array', () => {
      expect(toEpochMillisWithFallback([1609459200, 500000000], fallback)).toBe(1609459200000 + 500)
    })
  })

  describe('parseDate', () => {
    it('should parse ISO date string', () => {
      const result = parseDate('2021-01-01T00:00:00.000Z')
      expect(result).toBe(new Date('2021-01-01T00:00:00.000Z').getTime())
    })

    it('should parse date-only string', () => {
      const result = parseDate('2021-01-01')
      expect(result).not.toBeNull()
    })

    it('should return null for invalid date string', () => {
      expect(parseDate('not a date')).toBeNull()
      expect(parseDate('')).toBeNull()
    })

    it('should handle millisecond timestamp (large number)', () => {
      const ts = 1609459200000
      expect(parseDate(ts)).toBe(ts)
    })

    it('should convert second timestamp to milliseconds', () => {
      const seconds = 1609459200
      expect(parseDate(seconds)).toBe(seconds * 1000)
    })

    it('should return null for null/undefined', () => {
      expect(parseDate(null)).toBeNull()
      expect(parseDate(undefined)).toBeNull()
    })

    it('should return null for objects', () => {
      expect(parseDate({ date: '2021-01-01' })).toBeNull()
    })
  })
})
