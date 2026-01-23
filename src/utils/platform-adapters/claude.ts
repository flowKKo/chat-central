import type { PlatformAdapter } from './types'
import type { Conversation, Message } from '@/types'
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
  // Match conversation messages endpoint
  detailMessages:
    /\/api\/organizations\/[^/]+\/chat_conversations\/([a-f0-9-]+)\/messages(?:\?.*)?$/,
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

function extractClaudeMessageContent(message: any): string {
  if (!message) return ''
  if (typeof message.text === 'string' && message.text.trim()) return message.text
  if (typeof message.content === 'string' && message.content.trim()) return message.content
  if (message.content && typeof message.content.text === 'string' && message.content.text.trim()) {
    return message.content.text
  }
  if (Array.isArray(message.content)) {
    const joined = message.content
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (typeof part?.text === 'string') return part.text
        if (part?.type === 'text') return part.text
        return ''
      })
      .join('\n')
    if (joined.trim()) return joined
  }
  if (Array.isArray(message.blocks)) {
    const joined = message.blocks
      .map((part: any) => (part?.type === 'text' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
    if (joined.trim()) return joined
  }
  return ''
}

function normalizeListPayload(payload: any): any[] | null {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return null

  const candidates = [
    payload.chat_conversations,
    payload.conversations,
    payload.items,
    payload.data?.chat_conversations,
    payload.data?.conversations,
    payload.data?.items,
    payload.data,
    payload.results,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return null
}

function normalizeMessageList(payload: any): any[] | null {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return null

  const candidates = [payload.items, payload.messages, payload.data, payload.results]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  const values = Object.values(payload)
  if (values.length > 0 && values.every((value) => value && typeof value === 'object')) {
    return values
  }

  return null
}

function extractClaudeRole(message: any): 'user' | 'assistant' | null {
  const sender = message?.sender || message?.author || message?.role
  if (!sender) return null
  if (sender === 'human' || sender === 'user') return 'user'
  if (sender === 'assistant' || sender === 'model') return 'assistant'
  return null
}

function extractConversationIdFromMessage(message: any): string | null {
  return (
    message?.conversation_id ||
    message?.conversationId ||
    message?.chat_conversation_uuid ||
    message?.chatConversationUuid ||
    null
  )
}

export const claudeAdapter: PlatformAdapter = {
  platform: 'claude',

  shouldCapture(url: string): boolean {
    return url.includes('/api/organizations/') && url.includes('/chat_conversations')
  },

  getEndpointType(url: string): 'list' | 'detail' | 'stream' | 'unknown' {
    if (API_PATTERNS.stream.test(url)) return 'stream'
    if (API_PATTERNS.detail.test(url) || API_PATTERNS.detailMessages.test(url)) return 'detail'
    if (API_PATTERNS.list.test(url)) return 'list'
    return 'unknown'
  },

  parseConversationList(data: unknown): Conversation[] {
    // Claude returned conversation list format
    // [{ uuid, name, created_at, updated_at, ... }, ...]
    const parsed = parseJsonIfString(data)
    const items = normalizeListPayload(parsed)
    if (!items) {
      console.warn('[ChatCentral] Claude: Expected array for conversation list')
      return []
    }

    const now = Date.now()

    return items
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
            isFavorite: false,
            favoriteAt: null,
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

  parseConversationDetail(
    data: unknown
  ): { conversation: Conversation; messages: Message[] } | null {
    // Claude conversation detail format
    // { uuid, name, created_at, updated_at, chat_messages: [...] }
    const parsed = parseJsonIfString(data)
    if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
      console.warn('[ChatCentral] Claude: Invalid conversation detail data')
      return null
    }

    const item = parsed as any
    const base = item.conversation || item.chat_conversation || item
    const rawMessages =
      item.chat_messages ||
      item.messages ||
      item.items ||
      item.message_history ||
      item.data?.messages ||
      item.data?.items ||
      (Array.isArray(item) ? item : null)

    const messageList = normalizeMessageList(rawMessages)

    if (!messageList) {
      console.warn('[ChatCentral] Claude: No messages array in detail payload')
      return null
    }

    let originalId =
      base?.uuid ||
      base?.id ||
      base?.conversation_id ||
      base?.conversationId ||
      base?.chat_conversation_uuid

    const now = Date.now()
    const messages: Message[] = []
    let minCreatedAt = now
    let maxCreatedAt = 0

    for (const msg of messageList) {
      try {
        const messageId = msg?.uuid || msg?.id || msg?.message_id
        const role = extractClaudeRole(msg)
        const content = extractClaudeMessageContent(msg)
        if (!role || !content) continue

        if (!originalId) {
          const candidate = extractConversationIdFromMessage(msg)
          if (candidate) originalId = candidate
        }

        const createdAt = msg?.created_at
          ? new Date(msg.created_at).getTime()
          : msg?.createdAt
            ? new Date(msg.createdAt).getTime()
            : msg?.timestamp
              ? new Date(msg.timestamp).getTime()
              : now

        minCreatedAt = Math.min(minCreatedAt, createdAt)
        maxCreatedAt = Math.max(maxCreatedAt, createdAt)

        messages.push({
          id: `claude_${messageId || `${createdAt}_${messages.length + 1}`}`,
          conversationId: '',
          role,
          content,
          createdAt,
          _raw: msg,
        })
      } catch (e) {
        console.warn('[ChatCentral] Claude: Failed to parse message', e)
      }
    }

    if (!originalId || messages.length === 0) return null

    const titleSource = base?.name || base?.title
    const firstUserMessage = messages.find((m) => m.role === 'user')
    const title = titleSource || firstUserMessage?.content.slice(0, 80) || 'Untitled'

    const createdAt = base?.created_at
      ? new Date(base.created_at).getTime()
      : base?.createdAt
        ? new Date(base.createdAt).getTime()
        : minCreatedAt || now

    const updatedAt = base?.updated_at
      ? new Date(base.updated_at).getTime()
      : base?.updatedAt
        ? new Date(base.updatedAt).getTime()
        : maxCreatedAt || createdAt

    const conversation: Conversation = {
      id: `claude_${originalId}`,
      platform: 'claude',
      originalId,
      title,
      createdAt,
      updatedAt,
      messageCount: messages.length,
      preview: '',
      tags: [],
      syncedAt: now,
      detailStatus: 'full',
      detailSyncedAt: now,
      isFavorite: false,
      favoriteAt: null,
      url: this.buildConversationUrl(originalId),
    }

    for (const message of messages) {
      message.conversationId = conversation.id
    }

    // Set preview to the first user message
    if (firstUserMessage) {
      conversation.preview = firstUserMessage.content.slice(0, 200)
    }

    return { conversation, messages }
  },

  parseStreamResponse(
    data: unknown,
    url: string
  ): { conversation: Conversation; messages: Message[] } | null {
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
        if (
          typeof eventData?.completion === 'string' ||
          typeof eventData?.delta?.text === 'string'
        ) {
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
      isFavorite: false,
      favoriteAt: null,
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

    const messagesMatch = url.match(API_PATTERNS.detailMessages)
    if (messagesMatch) return messagesMatch[1] ?? null

    const streamMatch = url.match(API_PATTERNS.stream)
    if (streamMatch) return streamMatch[1] ?? null

    return null
  },

  buildConversationUrl(originalId: string): string {
    return `https://claude.ai/chat/${originalId}`
  },
}
