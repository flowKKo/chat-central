/**
 * Common timestamp utilities for platform adapters
 */

/**
 * Convert various timestamp formats to epoch milliseconds
 * Handles:
 * - [seconds, nanos] array format (Google/Gemini)
 * - Unix seconds (10 digits)
 * - Unix milliseconds (13 digits)
 * - ISO date strings
 */
export function toEpochMillis(value: unknown): number | null {
  // Handle [seconds, nanos] array format (Google/Gemini APIs)
  if (Array.isArray(value) && value.length === 2) {
    const [seconds, nanos] = value
    if (typeof seconds !== 'number' || typeof nanos !== 'number') return null
    // Validate seconds is in reasonable range (2001-2100 roughly)
    if (seconds < 1e9 || seconds > 1e11) return null
    return seconds * 1000 + Math.floor(nanos / 1e6)
  }

  // Handle numeric timestamps
  if (typeof value === 'number') {
    // Already in milliseconds (13 digits)
    if (value > 1e12) return value
    // In seconds (10 digits)
    if (value > 1e9) return value * 1000
    return null
  }

  // Handle ISO date strings
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

/**
 * Read timestamp from object using common field names
 */
export function readTimestampFromObject(obj: Record<string, unknown>): number | null {
  const candidates = [
    obj.timestamp,
    obj.createTime,
    obj.create_time,
    obj.created_at,
    obj.createdAt,
    obj.time,
    obj.ct,
  ]

  for (const candidate of candidates) {
    const ts = toEpochMillis(candidate)
    if (ts !== null) return ts
  }

  return null
}

/**
 * Find maximum timestamp in an array
 */
export function findMaxTimestampInArray(value: unknown[]): number | null {
  let max: number | null = null
  for (const item of value) {
    const ts = toEpochMillis(item)
    if (!ts) continue
    max = max === null ? ts : Math.max(max, ts)
  }
  return max
}

/**
 * Convert various timestamp formats to epoch milliseconds, returning a fallback
 * value when the input cannot be parsed.
 *
 * Convenience wrapper around `toEpochMillis` for call sites that need a
 * guaranteed numeric result (e.g. ChatGPT adapter timestamps).
 */
export function toEpochMillisWithFallback(value: unknown, fallback: number): number {
  return toEpochMillis(value) ?? fallback
}

/**
 * Parse date from various formats (string or number)
 */
export function parseDate(value: unknown): number | null {
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof value === 'number') {
    // Assume milliseconds if large enough
    return value > 1e12 ? value : value * 1000
  }
  return null
}
