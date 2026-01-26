import type { Message } from '@/types'

/**
 * Handlers for walking through nested data structures
 */
export interface WalkHandlers {
  array?: (value: unknown[]) => boolean | void
  object?: (value: Record<string, unknown>) => boolean | void
  string?: (value: string) => boolean | void
}

/**
 * State for tracking conversation detail parsing
 */
export interface DetailState {
  originalId: string
  title: string
  defaultTimestamp: number | null
  lastBaseTimestamp: number | null
  lastProducedTimestamp: number | null
  tieBreaker: number
  messages: Map<string, Message>
  earliestUserMessage: { content: string, timestamp: number } | null
}
