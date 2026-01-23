import { describe, it, expect } from 'vitest'
import {
  MS_PER_DAY,
  startOfDay,
  endOfDay,
  formatDateString,
  parseDateString,
  daysAgo,
} from './date'

describe('date utilities', () => {
  describe('mS_PER_DAY', () => {
    it('should equal 86400000 milliseconds', () => {
      expect(MS_PER_DAY).toBe(86400000)
    })
  })

  describe('startOfDay', () => {
    it('should return start of day (00:00:00.000)', () => {
      const ts = new Date('2024-06-15T14:30:45.123').getTime()
      const result = startOfDay(ts)
      const date = new Date(result)

      expect(date.getHours()).toBe(0)
      expect(date.getMinutes()).toBe(0)
      expect(date.getSeconds()).toBe(0)
      expect(date.getMilliseconds()).toBe(0)
      expect(date.getDate()).toBe(15)
    })
  })

  describe('endOfDay', () => {
    it('should return end of day (23:59:59.999)', () => {
      const ts = new Date('2024-06-15T14:30:45.123').getTime()
      const result = endOfDay(ts)
      const date = new Date(result)

      expect(date.getHours()).toBe(23)
      expect(date.getMinutes()).toBe(59)
      expect(date.getSeconds()).toBe(59)
      expect(date.getMilliseconds()).toBe(999)
      expect(date.getDate()).toBe(15)
    })
  })

  describe('formatDateString', () => {
    it('should format timestamp to YYYY-MM-DD', () => {
      const ts = new Date('2024-06-15T14:30:45').getTime()
      const result = formatDateString(ts)
      expect(result).toBe('2024-06-15')
    })

    it('should pad single digit months and days', () => {
      const ts = new Date('2024-01-05T10:00:00').getTime()
      const result = formatDateString(ts)
      expect(result).toBe('2024-01-05')
    })
  })

  describe('parseDateString', () => {
    it('should parse YYYY-MM-DD to timestamp', () => {
      const result = parseDateString('2024-06-15')
      expect(result).not.toBeNull()

      // Verify roundtrip: format the parsed result should give back the same string
      expect(formatDateString(result!)).toBe('2024-06-15')
    })

    it('should return null for empty string', () => {
      expect(parseDateString('')).toBeNull()
    })

    it('should return null for invalid format', () => {
      expect(parseDateString('15-06-2024')).toBeNull()
      expect(parseDateString('2024/06/15')).toBeNull()
      expect(parseDateString('invalid')).toBeNull()
    })
  })

  describe('daysAgo', () => {
    it('should return start of day N days ago', () => {
      const result = daysAgo(7)
      const now = Date.now()

      // Should be approximately 7 days ago
      const diff = now - result
      expect(diff).toBeGreaterThanOrEqual(7 * MS_PER_DAY)
      expect(diff).toBeLessThan(8 * MS_PER_DAY)

      // Should be start of day
      const date = new Date(result)
      expect(date.getHours()).toBe(0)
      expect(date.getMinutes()).toBe(0)
    })

    it('should return start of today for 0 days', () => {
      const result = daysAgo(0)
      const today = startOfDay(Date.now())
      expect(result).toBe(today)
    })
  })
})
