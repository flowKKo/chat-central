import type { Platform } from '@/types'

export interface ParsedSearchQuery {
  freeText: string
  operators: {
    platform?: Platform
    tags?: string[]
    before?: number
    after?: number
    isFavorite?: boolean
  }
}

/**
 * Parse search query with operators
 *
 * Supported operators:
 * - platform:claude / platform:chatgpt / platform:gemini
 * - tag:work (multiple allowed)
 * - before:YYYY-MM-DD
 * - after:YYYY-MM-DD
 * - is:favorite
 *
 * @example
 * parseSearchQuery("platform:claude hello")
 * // { freeText: "hello", operators: { platform: "claude" } }
 *
 * @example
 * parseSearchQuery("tag:work before:2024-01-01")
 * // { freeText: "", operators: { tags: ["work"], before: 1704067199999 } }
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const result: ParsedSearchQuery = {
    freeText: '',
    operators: {},
  }

  let processedQuery = query

  // Extract platform:xxx
  const platformMatch = processedQuery.match(/platform:(claude|chatgpt|gemini)/i)
  if (platformMatch && platformMatch[1]) {
    result.operators.platform = platformMatch[1].toLowerCase() as Platform
    processedQuery = processedQuery.replace(platformMatch[0], '')
  }

  // Extract tag:xxx (multiple allowed)
  const tagMatches = Array.from(processedQuery.matchAll(/tag:(\S+)/gi))
  const tags: string[] = []
  for (const match of tagMatches) {
    if (match[1]) {
      tags.push(match[1])
    }
    processedQuery = processedQuery.replace(match[0], '')
  }
  if (tags.length > 0) {
    result.operators.tags = tags
  }

  // Extract before:YYYY-MM-DD
  const beforeMatch = processedQuery.match(/before:(\d{4}-\d{2}-\d{2})/i)
  if (beforeMatch && beforeMatch[1]) {
    const ts = Date.parse(beforeMatch[1])
    if (!isNaN(ts)) {
      // End of day (23:59:59.999)
      result.operators.before = ts + 24 * 60 * 60 * 1000 - 1
    }
    processedQuery = processedQuery.replace(beforeMatch[0], '')
  }

  // Extract after:YYYY-MM-DD
  const afterMatch = processedQuery.match(/after:(\d{4}-\d{2}-\d{2})/i)
  if (afterMatch && afterMatch[1]) {
    const ts = Date.parse(afterMatch[1])
    if (!isNaN(ts)) {
      result.operators.after = ts
    }
    processedQuery = processedQuery.replace(afterMatch[0], '')
  }

  // Extract is:favorite
  if (/is:favorite/i.test(processedQuery)) {
    result.operators.isFavorite = true
    processedQuery = processedQuery.replace(/is:favorite/gi, '')
  }

  // Clean up remaining text
  result.freeText = processedQuery.trim().replace(/\s+/g, ' ')

  return result
}

/**
 * Check if query contains any operators
 */
export function hasOperators(query: string): boolean {
  return /(?:platform|tag|before|after|is):/i.test(query)
}

/**
 * Format parsed query back to string (for display)
 */
export function formatParsedQuery(parsed: ParsedSearchQuery): string {
  const parts: string[] = []

  if (parsed.operators.platform) {
    parts.push(`platform:${parsed.operators.platform}`)
  }
  if (parsed.operators.tags) {
    for (const tag of parsed.operators.tags) {
      parts.push(`tag:${tag}`)
    }
  }
  if (parsed.operators.after) {
    parts.push(`after:${new Date(parsed.operators.after).toISOString().split('T')[0]}`)
  }
  if (parsed.operators.before) {
    // Subtract 1 day to show the original date (we add end-of-day offset when parsing)
    const originalDate = new Date(parsed.operators.before - 24 * 60 * 60 * 1000 + 1)
    parts.push(`before:${originalDate.toISOString().split('T')[0]}`)
  }
  if (parsed.operators.isFavorite) {
    parts.push('is:favorite')
  }
  if (parsed.freeText) {
    parts.push(parsed.freeText)
  }

  return parts.join(' ')
}
