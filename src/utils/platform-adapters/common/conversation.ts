import type { Conversation, Platform } from '@/types'

export interface CreateConversationOptions {
  platform: Platform
  originalId: string
  title: string
  createdAt: number
  updatedAt: number
  now: number
  messageCount?: number
  preview?: string
  summary?: string
  detailStatus?: 'none' | 'partial' | 'full'
  url?: string
}

/**
 * Shared factory for creating Conversation objects with consistent defaults.
 * Used by all platform adapters (Claude, ChatGPT, Gemini).
 */
export function createConversation(opts: CreateConversationOptions): Conversation {
  const detailStatus = opts.detailStatus ?? 'none'
  return {
    id: `${opts.platform}_${opts.originalId}`,
    platform: opts.platform,
    originalId: opts.originalId,
    title: opts.title,
    createdAt: opts.createdAt,
    updatedAt: opts.updatedAt,
    messageCount: opts.messageCount ?? 0,
    preview: opts.preview ?? '',
    summary: opts.summary,
    tags: [],
    syncedAt: opts.now,
    detailStatus,
    detailSyncedAt: detailStatus === 'none' ? null : opts.now,
    isFavorite: false,
    favoriteAt: null,
    url: opts.url,
  }
}
