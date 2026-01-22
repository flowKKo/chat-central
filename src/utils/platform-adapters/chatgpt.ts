import type { Conversation, Message } from '@/types'
import type { PlatformAdapter } from './types'
import { parseJsonIfString, parseSseData } from './helpers'

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

function parseChatGptTimestamp(value: any, fallback: number): number {
  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

function normalizeConversationItems(payload: any): any[] | null {
  if (!payload || typeof payload !== 'object') return null
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.conversations)) return payload.conversations
  if (Array.isArray(payload.data?.items)) return payload.data.items
  return null
}

function extractContent(msg: any): string {
  if (!msg) return ''
  if (Array.isArray(msg.content?.parts)) {
    return msg.content.parts.filter((p: any) => typeof p === 'string').join('\n')
  }
  if (typeof msg.content?.text === 'string') return msg.content.text
  if (typeof msg.content === 'string') return msg.content
  return ''
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
    const items = normalizeConversationItems(parsed)
    if (!items) {
      console.warn('[ChatCentral] ChatGPT: Invalid conversation list data')
      return []
    }

    const now = Date.now()

    return items
      .map((item: any) => {
        try {
          const originalId = item.id
          if (!originalId) return null

          const createdAt = parseChatGptTimestamp(item.create_time, now)
          const updatedAt = parseChatGptTimestamp(item.update_time, createdAt)
          const previewSource = item.snippet || item.title || ''

          const conversation: Conversation = {
            id: `chatgpt_${originalId}`,
            platform: 'chatgpt',
            originalId,
            title: item.title || 'New chat',
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
          console.warn('[ChatCentral] ChatGPT: Failed to parse conversation', e)
          return null
        }
      })
      .filter((c): c is Conversation => c !== null)
  },

  parseConversationDetail(data: unknown): { conversation: Conversation; messages: Message[] } | null {
    // ChatGPT conversation detail format
    // { title, create_time, update_time, mapping: { [node_id]: { message, parent, children } }, ... }
    const parsed = parseJsonIfString(data)
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[ChatCentral] ChatGPT: Invalid conversation detail data')
      return null
    }

    let item = parsed as any
    
    // Handle streaming data
    if (item.isStream && Array.isArray(item.events)) {
      // Find full state containing mapping in events
      // Usually the last event containing mapping
      const eventWithMapping = [...item.events].reverse().find((e: any) => e && e.mapping)
      
      if (eventWithMapping) {
        item = eventWithMapping
      } else {
        // If mapping not found, it might be incremental update, currently unable to process
        // Unless we can build full message from increment
        console.warn('[ChatCentral] ChatGPT: Stream events do not contain full mapping')
        return null
      }
    }

    const originalId = item.conversation_id || item.id
    if (!originalId) return null

    const now = Date.now()

    const createdAt = parseChatGptTimestamp(item.create_time, now)
    const updatedAt = parseChatGptTimestamp(item.update_time, createdAt)

    const conversation: Conversation = {
      id: `chatgpt_${originalId}`,
      platform: 'chatgpt',
      originalId,
      title: item.title || 'New chat',
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
      const nodes = Object.values(mapping) as any[]

      for (const node of nodes) {
        try {
          const msg = node.message
          if (!msg) continue

          const messageId = msg.id
          if (!messageId) continue

          // Skip system messages
          const author = msg.author?.role
          if (!author || author === 'system') continue

          const role = author === 'user' ? 'user' : 'assistant'

          // Content is in content.parts array
          const content = extractContent(msg)

          if (!content) continue

          messages.push({
            id: `chatgpt_${messageId}`,
            conversationId: conversation.id,
            role,
            content,
            createdAt: parseChatGptTimestamp(msg.create_time, now),
            _raw: msg,
          })
        } catch (e) {
          console.warn('[ChatCentral] ChatGPT: Failed to parse message', e)
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

  parseStreamResponse(data: unknown, url: string): { conversation: Conversation; messages: Message[] } | null {
    let raw = ''
    if (typeof data === 'string') {
      raw = data
    } else if (data && typeof data === 'object' && Array.isArray((data as any).events)) {
      raw = (data as any).events.map((event: any) => JSON.stringify(event)).join('\n\n')
    } else {
      return null
    }

    const payloads = parseSseData(raw)
    if (payloads.length === 0) return null

    const now = Date.now()
    const messagesById = new Map<string, Message>()
    let conversationId = this.extractConversationId(url) || ''

    for (const payload of payloads) {
      if (payload === '[DONE]') continue

      let eventData: any = null
      try {
        eventData = JSON.parse(payload)
      } catch {
        continue
      }

      if (eventData?.conversation_id) {
        conversationId = eventData.conversation_id
      }

      const msg = eventData?.message
      if (!msg) continue

      if (msg.conversation_id) {
        conversationId = msg.conversation_id
      }

      const messageId = msg.id
      if (!messageId) continue

      const author = msg.author?.role
      if (!author || author === 'system') continue

      const role = author === 'user' ? 'user' : 'assistant'
      const content = extractContent(msg)
      if (!content) continue

      const createdAt = parseChatGptTimestamp(msg.create_time, now)
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
