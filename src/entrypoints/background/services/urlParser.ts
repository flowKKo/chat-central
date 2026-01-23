import { PLATFORM_CONFIG, type Conversation, type Platform } from '@/types'

export type ParsedConversation = {
  platform: Platform
  originalId: string
  conversationId: string
  url: string
}

/**
 * Parse conversation info from a URL
 */
export function parseConversationFromUrl(rawUrl: string): ParsedConversation | null {
  try {
    const url = new URL(rawUrl)
    const { hostname, pathname } = url

    if (hostname === 'claude.ai') {
      const match = pathname.match(/\/chat\/([^/]+)/)
      if (!match?.[1]) return null
      const originalId = match[1]
      return {
        platform: 'claude',
        originalId,
        conversationId: `claude_${originalId}`,
        url: rawUrl,
      }
    }

    if (hostname === 'chatgpt.com' || hostname === 'chat.openai.com') {
      const match = pathname.match(/\/c\/([^/]+)/)
      if (!match?.[1]) return null
      const originalId = match[1]
      return {
        platform: 'chatgpt',
        originalId,
        conversationId: `chatgpt_${originalId}`,
        url: rawUrl,
      }
    }

    if (hostname === 'gemini.google.com') {
      const match = pathname.match(/\/app\/([^/]+)/)
      if (!match?.[1]) return null
      const originalId = match[1]
      return {
        platform: 'gemini',
        originalId,
        conversationId: `gemini_${originalId}`,
        url: rawUrl,
      }
    }
  } catch {
    return null
  }

  return null
}

/**
 * Build a placeholder conversation from parsed URL info
 */
export function buildPlaceholderConversation(
  parsed: ParsedConversation,
  now: number
): Conversation {
  return {
    id: parsed.conversationId,
    platform: parsed.platform,
    originalId: parsed.originalId,
    title: 'Unknown conversation',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    preview: '',
    tags: [],
    syncedAt: now,
    detailStatus: 'none',
    detailSyncedAt: null,
    isFavorite: false,
    favoriteAt: null,
    url: parsed.url || PLATFORM_CONFIG[parsed.platform].baseUrl,
  }
}
