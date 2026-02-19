import type { WalkHandlers } from './types'
import { parseJsonSafe, findMaxTimestampInArray } from '../common'
import { CONVERSATION_ID_RE, RESPONSE_ID_RE, RESPONSE_ID_SHORT_RE } from './constants'

/**
 * Normalize conversation ID by removing 'c_' prefix
 */
export function normalizeConversationId(id: string): string {
  return id.startsWith('c_') ? id.slice(2) : id
}

/**
 * Check if value is a conversation ID
 */
export function isConversationId(value: unknown): value is string {
  return typeof value === 'string' && CONVERSATION_ID_RE.test(value)
}

/**
 * Check if value is a response ID
 */
export function isResponseId(value: unknown): value is string {
  return (
    typeof value === 'string' && (RESPONSE_ID_RE.test(value) || RESPONSE_ID_SHORT_RE.test(value))
  )
}

/**
 * Check if value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/**
 * Find timestamp in array (re-export from common)
 */
export const findTimestampInArray = findMaxTimestampInArray

const MAX_WALK_DEPTH = 50

/**
 * Walk through nested data structure and call handlers.
 * Has a depth limit to prevent stack overflow from malformed data.
 */
export function walk(value: unknown, handlers: WalkHandlers, depth: number = 0): void {
  if (!value || depth > MAX_WALK_DEPTH) return

  if (Array.isArray(value)) {
    const skip = handlers.array?.(value)
    if (skip) return
    for (const item of value) {
      walk(item, handlers, depth + 1)
    }
    return
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const skip = handlers.object?.(obj)
    if (skip) return
    for (const item of Object.values(obj)) {
      walk(item, handlers, depth + 1)
    }
    return
  }

  if (typeof value === 'string') {
    const skip = handlers.string?.(value)
    if (skip) return
    if (value.startsWith('[') || value.startsWith('{')) {
      const parsed = parseJsonSafe(value)
      if (parsed) walk(parsed, handlers, depth + 1)
    }
  }
}
