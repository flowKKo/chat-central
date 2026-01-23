/**
 * Date utility constants and helpers
 */

/** Milliseconds in one day */
export const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Milliseconds in one hour */
export const MS_PER_HOUR = 60 * 60 * 1000

/**
 * Get start of day (00:00:00.000) for a given timestamp
 */
export function startOfDay(ts: number): number {
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Get end of day (23:59:59.999) for a given timestamp
 */
export function endOfDay(ts: number): number {
  const date = new Date(ts)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

/**
 * Format timestamp to YYYY-MM-DD string (local timezone)
 */
export function formatDateString(ts: number): string {
  const date = new Date(ts)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse YYYY-MM-DD string to timestamp (start of day, local timezone)
 */
export function parseDateString(dateStr: string): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null
  }
  // Use Date constructor with explicit parts to ensure local timezone
  const parts = dateStr.split('-').map(Number)
  const year = parts[0]
  const month = parts[1]
  const day = parts[2]
  if (year === undefined || month === undefined || day === undefined) {
    return null
  }
  const date = new Date(year, month - 1, day) // month is 0-indexed
  return date.getTime()
}

/**
 * Get timestamp for N days ago (start of that day)
 */
export function daysAgo(days: number): number {
  return startOfDay(Date.now() - days * MS_PER_DAY)
}
