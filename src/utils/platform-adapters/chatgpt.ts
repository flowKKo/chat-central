import type { PlatformAdapter } from './types'
import { extractSsePayloads, normalizeListPayload, parseJsonIfString } from './helpers'
import { extractChatGPTContent, toEpochMillisWithFallback } from './common'
import type { Conversation, Message } from '@/types'
import { createLogger } from '@/utils/logger'

const log = createLogger('ChatGPT')

/**
 * ChatGPT API Endpoint Patterns
 *
 * Conversation List: GET /backend-api/conversations
 * Conversation Detail: GET /backend-api/conversation/{conversation_id}
 * Message Stream:   POST /backend-api/conversation
 */
const API_PATTERNS = {
  // Match conversation list
  list: /\/backend-api\/conversations(\?.*)?$/,
  // Match conversation detail
  detail: /\/backend-api\/conversation\/([a-f0-9-]+)\/?(?:\?.*)?$/,
  // Match message stream POST
  stream: /\/backend-api\/conversation\/?(?:\?.*)?$/,
}

export const chatgptAdapter: PlatformAdapter = {
  platform: 'chatgpt',

  shouldCapture(url: string): boolean {
    return url.includes('/backend-api/conversation') || url.includes('/backend-api/conversations')
  },

  getEndpointType(url: string): 'list' | 'detail' | 'stream' | 'unknown' {
    if (API_PATTERNS.list.test(url)) return 'list'
    if (API_PATTERNS.detail.test(url)) return 'detail'
    if (API_PATTERNS.stream.test(url)) return 'stream'
    return 'unknown'
  },

  parseConversationList(data: unknown): Conversation[] {
    // ChatGPT returned format
    // { items: [{ id, title, create_time, update_time, ... }], ... }
    const parsed = parseJsonIfString(data)
    const items = normalizeListPayload(parsed)
    if (!items) {
      log.warn('Invalid conversation list data')
      return []
    }

    const now = Date.now()

    return items
      .map((item: unknown) => {
        try {
          if (!item || typeof item !== 'object') return null
          const obj = item as Record<string, unknown>
          const originalId = obj.id as string | undefined
          if (!originalId) return null

          const createdAt = toEpochMillisWithFallback(obj.create_time, now)
          const updatedAt = toEpochMillisWithFallback(obj.update_time, createdAt)
          const previewSource = (obj.snippet as string) || (obj.title as string) || ''

          const conversation: Conversation = {
            id: `chatgpt_${originalId}`,
            platform: 'chatgpt',
            originalId,
            title: (obj.title as string) || 'New chat',
            createdAt,
            updatedAt,
            messageCount: 0, // No message count in the list
            preview: previewSource,
            tags: [],
            syncedAt: now,
            detailStatus: 'none',
            detailSyncedAt: null,
            isFavorite: false,
            favoriteAt: null,
            url: this.buildConversationUrl(originalId),
          }

          return conversation
        } catch (e) {
          log.warn('Failed to parse conversation', e)
          return null
        }
      })
      .filter((c): c is Conversation => c !== null)
  },

  parseConversationDetail(
    data: unknown
  ): { conversation: Conversation; messages: Message[] } | null {
    // ChatGPT conversation detail format
    // { title, create_time, update_time, mapping: { [node_id]: { message, parent, children } }, ... }
    const parsed = parseJsonIfString(data)
    if (!parsed || typeof parsed !== 'object') {
      log.warn('Invalid conversation detail data')
      return null
    }

    let item = parsed as Record<string, unknown>

    // Handle streaming data
    if (item.isStream && Array.isArray(item.events)) {
      // Find full state containing mapping in events
      // Usually the last event containing mapping
      const eventWithMapping = [...item.events]
        .reverse()
        .find((e: unknown) => e && typeof e === 'object' && 'mapping' in (e as object))

      if (eventWithMapping) {
        item = eventWithMapping as Record<string, unknown>
      } else {
        // If mapping not found, it might be incremental update, currently unable to process
        // Unless we can build full message from increment
        log.warn('Stream events do not contain full mapping')
        return null
      }
    }

    const originalId = (item.conversation_id as string) || (item.id as string)
    if (!originalId) return null

    const now = Date.now()

    const createdAt = toEpochMillisWithFallback(item.create_time, now)
    const updatedAt = toEpochMillisWithFallback(item.update_time, createdAt)

    const conversation: Conversation = {
      id: `chatgpt_${originalId}`,
      platform: 'chatgpt',
      originalId,
      title: (item.title as string) || 'New chat',
      createdAt,
      updatedAt,
      messageCount: 0,
      preview: '',
      tags: [],
      syncedAt: now,
      detailStatus: 'full',
      detailSyncedAt: now,
      isFavorite: false,
      favoriteAt: null,
      url: this.buildConversationUrl(originalId),
    }

    const messages: Message[] = []
    const mapping = item.mapping

    if (mapping && typeof mapping === 'object') {
      // ChatGPT uses tree structure to store messages
      // Need to traverse mapping and sort by time
      const nodes = Object.values(mapping) as unknown[]

      for (const node of nodes) {
        try {
          if (!node || typeof node !== 'object') continue
          const nodeObj = node as Record<string, unknown>
          const msg = nodeObj.message as Record<string, unknown> | undefined
          if (!msg) continue

          const messageId = msg.id as string | undefined
          if (!messageId) continue

          // Skip system messages
          const author = (msg.author as Record<string, unknown> | undefined)?.role as
            | string
            | undefined
          if (!author || author === 'system') continue

          const role = author === 'user' ? 'user' : 'assistant'

          // Content is in content.parts array
          const content = extractChatGPTContent(msg)

          if (!content) continue

          messages.push({
            id: `chatgpt_${messageId}`,
            conversationId: conversation.id,
            role,
            content,
            createdAt: toEpochMillisWithFallback(msg.create_time, now),
            _raw: msg,
          })
        } catch (e) {
          log.warn('Failed to parse message', e)
        }
      }

      // Sort by time
      messages.sort((a, b) => a.createdAt - b.createdAt)
    }

    conversation.messageCount = messages.length

    // Set preview
    const firstUserMessage = messages.find((m) => m.role === 'user')
    if (firstUserMessage) {
      conversation.preview = firstUserMessage.content.slice(0, 200)
    }

    return { conversation, messages }
  },

  parseStreamResponse(
    data: unknown,
    url: string
  ): { conversation: Conversation; messages: Message[] } | null {
    const payloads = extractSsePayloads(data)
    if (!payloads) return null

    const now = Date.now()
    const messagesById = new Map<string, Message>()
    let conversationId = this.extractConversationId(url) || ''

    for (const payload of payloads) {
      if (payload === '[DONE]') continue

      let eventData: Record<string, unknown> | null = null
      try {
        eventData = JSON.parse(payload) as Record<string, unknown>
      } catch {
        continue
      }

      if (eventData?.conversation_id) {
        conversationId = eventData.conversation_id as string
      }

      const msg = eventData?.message as Record<string, unknown> | undefined
      if (!msg) continue

      if (msg.conversation_id) {
        conversationId = msg.conversation_id as string
      }

      const messageId = msg.id as string | undefined
      if (!messageId) continue

      const author = (msg.author as Record<string, unknown> | undefined)?.role as string | undefined
      if (!author || author === 'system') continue

      const role = author === 'user' ? 'user' : 'assistant'
      const content = extractChatGPTContent(msg)
      if (!content) continue

      const createdAt = toEpochMillisWithFallback(msg.create_time, now)
      const id = `chatgpt_${messageId}`

      const existing = messagesById.get(id)
      if (existing) {
        if (content.length >= existing.content.length) {
          existing.content = content
        }
        existing.createdAt = Math.min(existing.createdAt, createdAt)
        continue
      }

      messagesById.set(id, {
        id,
        conversationId: `chatgpt_${conversationId}`,
        role,
        content,
        createdAt,
        _raw: msg,
      })
    }

    if (!conversationId || messagesById.size === 0) return null

    for (const msg of messagesById.values()) {
      msg.conversationId = `chatgpt_${conversationId}`
    }

    const messages = Array.from(messagesById.values()).sort((a, b) => a.createdAt - b.createdAt)
    const firstUser = messages.find((m) => m.role === 'user')
    const previewSource = firstUser?.content || messages[0]?.content || ''
    const titleSource = firstUser?.content || messages[0]?.content || 'New chat'

    const conversation: Conversation = {
      id: `chatgpt_${conversationId}`,
      platform: 'chatgpt',
      originalId: conversationId,
      title: titleSource.slice(0, 80),
      createdAt: messages[0]?.createdAt ?? now,
      updatedAt: messages[messages.length - 1]?.createdAt ?? now,
      messageCount: messages.length,
      preview: previewSource.slice(0, 200),
      tags: [],
      syncedAt: now,
      detailStatus: 'partial',
      detailSyncedAt: now,
      isFavorite: false,
      favoriteAt: null,
      url: this.buildConversationUrl(conversationId),
    }

    return { conversation, messages }
  },

  extractConversationId(url: string): string | null {
    const match = url.match(API_PATTERNS.detail)
    return match?.[1] ?? null
  },

  buildConversationUrl(originalId: string): string {
    return `https://chatgpt.com/c/${originalId}`
  },
}
