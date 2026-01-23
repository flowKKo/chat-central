import type { Conversation, Message } from '@/types'
import type { PlatformAdapter } from '../types'
import { API_PATTERNS, GEMINI_APP_URL } from './constants'
import { getPayloadSources } from './payload'
import { parseConversationListPayload } from './list'
import { parseConversationDetailPayload } from './detail'

export const geminiAdapter: PlatformAdapter = {
  platform: 'gemini',

  shouldCapture(url: string): boolean {
    return (
      url.includes('gemini.google.com') &&
      (API_PATTERNS.batch.test(url) || API_PATTERNS.conversations.test(url))
    )
  },

  getEndpointType(): 'list' | 'detail' | 'stream' | 'unknown' {
    return 'unknown'
  },

  parseConversationList(data: unknown): Conversation[] {
    const sources = getPayloadSources(data)
    if (sources.length === 0) {
      console.warn('[ChatCentral] Gemini: No data received')
      return []
    }

    const now = Date.now()
    const conversations: Conversation[] = []
    for (const payload of sources) {
      conversations.push(...parseConversationListPayload(payload, now))
    }

    return conversations
  },

  parseConversationDetail(
    data: unknown
  ): { conversation: Conversation; messages: Message[] } | null {
    const sources = getPayloadSources(data)
    if (sources.length === 0) {
      console.warn('[ChatCentral] Gemini: No detail data received')
      return null
    }

    const now = Date.now()
    let conversation: Conversation | null = null
    const messageMap = new Map<string, Message>()

    const upsertMergedMessage = (message: Message) => {
      const existing = messageMap.get(message.id)
      if (!existing) {
        messageMap.set(message.id, message)
        return
      }
      const content =
        message.content.length >= existing.content.length ? message.content : existing.content
      const createdAt = Math.min(existing.createdAt, message.createdAt)
      messageMap.set(message.id, { ...existing, ...message, content, createdAt })
    }

    const mergeConversationMeta = (
      current: Conversation,
      incoming: Conversation
    ): Conversation => {
      const title =
        current.title.length >= incoming.title.length ? current.title : incoming.title
      return {
        ...current,
        ...incoming,
        title,
        createdAt: Math.min(current.createdAt, incoming.createdAt),
        updatedAt: Math.max(current.updatedAt, incoming.updatedAt),
        messageCount: Math.max(current.messageCount, incoming.messageCount),
      }
    }

    for (const payload of sources) {
      const result = parseConversationDetailPayload(payload, now)
      if (!result) continue
      conversation = conversation
        ? mergeConversationMeta(conversation, result.conversation)
        : result.conversation
      result.messages.forEach(upsertMergedMessage)
    }

    if (!conversation || messageMap.size === 0) return null

    const messages = Array.from(messageMap.values()).sort((a, b) => a.createdAt - b.createdAt)
    const updatedAt = messages[messages.length - 1]?.createdAt ?? conversation.updatedAt

    return {
      conversation: {
        ...conversation,
        updatedAt,
        messageCount: messages.length,
      },
      messages,
    }
  },

  extractConversationId(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const sourcePath = urlObj.searchParams.get('source-path')
      if (sourcePath) {
        const match = sourcePath.match(/\/app\/([a-z0-9]+)$/i)
        if (match) return match[1] ?? null
      }

      const pathMatch = urlObj.pathname.match(/\/app\/([a-z0-9]+)$/i)
      if (pathMatch) return pathMatch[1] ?? null

      return urlObj.searchParams.get('id') || urlObj.searchParams.get('c') || null
    } catch {
      return null
    }
  },

  buildConversationUrl(originalId: string): string {
    return `${GEMINI_APP_URL}${originalId}`
  },

  parseStreamResponse(): { conversation: Conversation; messages: Message[] } | null {
    return null
  },
}
