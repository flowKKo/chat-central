import type { Conversation, Message } from '@/types'
import type { PlatformAdapter } from './types'
import { parseJsonIfString, parseSseData } from './helpers'

/**
 * Claude API Endpoint Patterns
 *
 * Conversation List: GET /api/organizations/{org_id}/chat_conversations
 * Conversation Detail: GET /api/organizations/{org_id}/chat_conversations/{conversation_id}
 * Message Stream:   POST /api/organizations/{org_id}/chat_conversations/{conversation_id}/completion
 */
const API_PATTERNS = {
  // Match conversation list
  list: /\/api\/organizations\/[^/]+\/chat_conversations\/?(\?.*)?$/,
  // Match conversation detail (exclude completion etc. subpaths)
  detail: /\/api\/organizations\/[^/]+\/chat_conversations\/([a-f0-9-]+)\/?(?:\?.*)?$/,
  // Match message stream
  stream: /\/api\/organizations\/[^/]+\/chat_conversations\/([a-f0-9-]+)\/completion(?:\?.*)?$/,
}

function extractClaudeContent(payload: any): string {
  if (!payload) return ''
  if (typeof payload.completion === 'string') return payload.completion
  if (typeof payload.delta?.text === 'string') return payload.delta.text

  const message = payload.message ?? payload
  if (typeof message.text === 'string') return message.text
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (part.type === 'text') return part.text
        return ''
      })
      .join('\n')
  }

  return ''
}

export const claudeAdapter: PlatformAdapter = {
  platform: 'claude',

  shouldCapture(url: string): boolean {
    return (
      url.includes('/api/organizations/') &&
      url.includes('/chat_conversations')
    )
  },

  getEndpointType(url: string): 'list' | 'detail' | 'stream' | 'unknown' {
    if (API_PATTERNS.stream.test(url)) return 'stream'
    if (API_PATTERNS.detail.test(url)) return 'detail'
    if (API_PATTERNS.list.test(url)) return 'list'
    return 'unknown'
  },

  parseConversationList(data: unknown): Conversation[] {
    // Claude returned conversation list format
    // [{ uuid, name, created_at, updated_at, ... }, ...]
    const parsed = parseJsonIfString(data)
    if (!Array.isArray(parsed)) {
      console.warn('[ChatCentral] Claude: Expected array for conversation list')
      return []
    }

    const now = Date.now()

    return parsed
      .map((item: any) => {
        try {
          const originalId = item.uuid || item.id
          if (!originalId) return null

          const conversation: Conversation = {
            id: `claude_${originalId}`,
            platform: 'claude',
            originalId,
            title: item.name || 'Untitled',
            createdAt: item.created_at ? new Date(item.created_at).getTime() : now,
            updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : now,
            messageCount: item.message_count ?? 0,
            preview: item.preview || '',
            tags: [],
            syncedAt: now,
            detailStatus: 'none',
            detailSyncedAt: null,
            url: this.buildConversationUrl(originalId),
          }

          return conversation
        } catch (e) {
          console.warn('[ChatCentral] Claude: Failed to parse conversation', e)
          return null
        }
      })
      .filter((c): c is Conversation => c !== null)
  },

  parseConversationDetail(data: unknown): { conversation: Conversation; messages: Message[] } | null {
    // Claude conversation detail format
    // { uuid, name, created_at, updated_at, chat_messages: [...] }
    const parsed = parseJsonIfString(data)
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[ChatCentral] Claude: Invalid conversation detail data')
      return null
    }

    const item = parsed as any
    const originalId = item.uuid || item.id
    if (!originalId) return null

    const now = Date.now()

    const conversation: Conversation = {
      id: `claude_${originalId}`,
      platform: 'claude',
      originalId,
      title: item.name || 'Untitled',
      createdAt: item.created_at ? new Date(item.created_at).getTime() : now,
      updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : now,
      messageCount: item.chat_messages?.length ?? 0,
      preview: '',
      tags: [],
      syncedAt: now,
      detailStatus: 'full',
      detailSyncedAt: now,
      url: this.buildConversationUrl(originalId),
    }

    const messages: Message[] = []

    if (Array.isArray(item.chat_messages)) {
      for (const msg of item.chat_messages) {
        try {
          const messageId = msg.uuid || msg.id
          if (!messageId) continue

          // Claude message format
          // { uuid, sender, text, created_at, ... }
          // sender: 'human' | 'assistant'
          const role = msg.sender === 'human' ? 'user' : 'assistant'

          // Content might be in text or content fields
          let content = ''
          if (typeof msg.text === 'string') {
            content = msg.text
          } else if (Array.isArray(msg.content)) {
            // Handle multi-part content
            content = msg.content
              .map((part: any) => {
                if (typeof part === 'string') return part
                if (part.type === 'text') return part.text
                return ''
              })
              .join('\n')
          } else if (typeof msg.content === 'string') {
            content = msg.content
          }

          messages.push({
            id: `claude_${messageId}`,
            conversationId: conversation.id,
            role,
            content,
            createdAt: msg.created_at ? new Date(msg.created_at).getTime() : now,
            _raw: msg,
          })
        } catch (e) {
          console.warn('[ChatCentral] Claude: Failed to parse message', e)
        }
      }
    }

    // Set preview to the first user message
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
    let conversationId = this.extractConversationId(url) || ''
    let content = ''
    let messageId = ''
    let createdAt = now
    let title = ''

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
      if (msg) {
        messageId = msg.uuid || msg.id || messageId
        if (msg.created_at) {
          createdAt = new Date(msg.created_at).getTime()
        }
        if (msg.name) {
          title = msg.name
        }
      }

      const chunk = extractClaudeContent(eventData)
      if (chunk) {
        if (typeof eventData?.completion === 'string' || typeof eventData?.delta?.text === 'string') {
          content += chunk
        } else if (chunk.length > content.length) {
          content = chunk
        }
      }
    }

    if (!conversationId || !content) return null

    const finalMessageId = messageId || `${conversationId}_${createdAt}`
    const conversation: Conversation = {
      id: `claude_${conversationId}`,
      platform: 'claude',
      originalId: conversationId,
      title: title || 'Claude chat',
      createdAt,
      updatedAt: createdAt,
      messageCount: 1,
      preview: content.slice(0, 200),
      tags: [],
      syncedAt: now,
      detailStatus: 'partial',
      detailSyncedAt: now,
      url: this.buildConversationUrl(conversationId),
    }

    const messages: Message[] = [
      {
        id: `claude_${finalMessageId}`,
        conversationId: conversation.id,
        role: 'assistant',
        content,
        createdAt,
      },
    ]

    return { conversation, messages }
  },

  extractConversationId(url: string): string | null {
    const detailMatch = url.match(API_PATTERNS.detail)
    if (detailMatch) return detailMatch[1] ?? null

    const streamMatch = url.match(API_PATTERNS.stream)
    if (streamMatch) return streamMatch[1] ?? null

    return null
  },

  buildConversationUrl(originalId: string): string {
    return `https://claude.ai/chat/${originalId}`
  },
}
