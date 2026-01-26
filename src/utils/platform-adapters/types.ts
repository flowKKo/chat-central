import type { Conversation, Message, Platform } from '@/types'

/**
 * Platform Adapter Interface
 * Each AI platform needs to implement this interface to parse its API responses
 */
export interface PlatformAdapter {
  platform: Platform

  /**
   * Check if the URL is an API endpoint that needs to be intercepted
   */
  shouldCapture: (url: string) => boolean

  /**
   * Determine if it is a conversation list or conversation detail
   */
  getEndpointType: (url: string) => 'list' | 'detail' | 'stream' | 'unknown'

  /**
   * Parse conversation list API response
   */
  parseConversationList: (data: unknown) => Conversation[]

  /**
   * Parse single conversation detail API response
   */
  parseConversationDetail: (
    data: unknown
  ) => { conversation: Conversation, messages: Message[] } | null

  /**
   * Parse streaming response (SSE / batchexecute etc.)
   */
  parseStreamResponse?: (
    data: unknown,
    url: string
  ) => { conversation: Conversation, messages: Message[] } | null

  /**
   * Extract conversation ID from URL
   */
  extractConversationId: (url: string) => string | null

  /**
   * Generate conversation URL
   */
  buildConversationUrl: (originalId: string) => string
}

/**
 * Captured API response data
 */
export interface CapturedResponse {
  url: string
  platform: Platform
  endpointType: 'list' | 'detail' | 'stream' | 'unknown'
  data: unknown
  timestamp: number
}
