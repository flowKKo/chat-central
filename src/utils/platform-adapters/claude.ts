import type { PlatformAdapter } from './types'
import type { Conversation, Message } from '@/types'
import { extractSsePayloads, normalizeListPayload, parseJsonIfString } from './helpers'
import { extractRole } from './common'
import { createLogger } from '@/utils/logger'

const log = createLogger('Claude')

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

function extractClaudeContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const obj = payload as Record<string, unknown>
  if (typeof obj.completion === 'string') return obj.completion
  const delta = obj.delta as Record<string, unknown> | undefined
  if (typeof delta?.text === 'string') return delta.text

  const message = (obj.message ?? obj) as Record<string, unknown>
  if (typeof message.text === 'string') return message.text
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .map((part: unknown) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object') {
          const partObj = part as Record<string, unknown>
          if (partObj.type === 'text') return partObj.text as string
        }
        return ''
      })
      .join('\n')
  }

  return ''
}

function extractClaudeMessageContent(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const msg = message as Record<string, unknown>
  if (typeof msg.text === 'string' && msg.text.trim()) return msg.text
  if (typeof msg.content === 'string' && msg.content.trim()) return msg.content
  const contentObj = msg.content as Record<string, unknown> | unknown[] | undefined
  if (contentObj && typeof contentObj === 'object' && !Array.isArray(contentObj)) {
    if (typeof contentObj.text === 'string' && contentObj.text.trim()) {
      return contentObj.text
    }
  }
  if (Array.isArray(msg.content)) {
    const joined = msg.content
      .map((part: unknown) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object') {
          const partObj = part as Record<string, unknown>
          if (typeof partObj.text === 'string') return partObj.text
          if (partObj.type === 'text' && typeof partObj.text === 'string') return partObj.text
        }
        return ''
      })
      .join('\n')
    if (joined.trim()) return joined
  }
  if (Array.isArray(msg.blocks)) {
    const joined = msg.blocks
      .map((part: unknown) => {
        if (part && typeof part === 'object') {
          const partObj = part as Record<string, unknown>
          return partObj.type === 'text' ? (partObj.text as string) : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
    if (joined.trim()) return joined
  }
  return ''
}

function normalizeMessageList(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return null

  const obj = payload as Record<string, unknown>
  const candidates = [obj.items, obj.messages, obj.data, obj.results]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  const values = Object.values(obj)
  if (values.length > 0 && values.every((value) => value && typeof value === 'object')) {
    return values
  }

  return null
}

function extractConversationIdFromMessage(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null
  const msg = message as Record<string, unknown>
  return (
    (msg.conversation_id as string | undefined)
    || (msg.conversationId as string | undefined)
    || (msg.chat_conversation_uuid as string | undefined)
    || (msg.chatConversationUuid as string | undefined)
    || null
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
    const items = normalizeListPayload(parsed, [
      'chat_conversations',
      'conversations',
      'items',
      'results',
    ])
    if (!items) {
      log.warn('Expected array for conversation list')
      return []
    }

    const now = Date.now()

    return items
      .map((item: unknown) => {
        try {
          if (!item || typeof item !== 'object') return null
          const obj = item as Record<string, unknown>
          const originalId = (obj.uuid as string) || (obj.id as string)
          if (!originalId) return null

          // Extract and clean summary (remove "**Conversation Overview**\n\n" prefix if present)
          let summary = (obj.summary as string) || ''
          if (summary.startsWith('**Conversation Overview**')) {
            summary = summary.replace(/^\*\*Conversation Overview\*\*\n+/, '').trim()
          }
          if (summary.startsWith('**Conversation overview**')) {
            summary = summary.replace(/^\*\*Conversation overview\*\*\n+/, '').trim()
          }

          const conversation: Conversation = {
            id: `claude_${originalId}`,
            platform: 'claude',
            originalId,
            title: (obj.name as string) || 'Untitled',
            createdAt: obj.created_at ? new Date(obj.created_at as string).getTime() : now,
            updatedAt: obj.updated_at ? new Date(obj.updated_at as string).getTime() : now,
            messageCount: (obj.message_count as number) ?? 0,
            preview: (obj.preview as string) || '',
            summary: summary || undefined,
            tags: [],
            syncedAt: now,
            detailStatus: 'none',
            detailSyncedAt: null,
            isFavorite: false,
            favoriteAt: null,
            url: this.buildConversationUrl(originalId),
          }

          return conversation
        }
        catch (e) {
          log.warn('Failed to parse conversation', e)
          return null
        }
      })
      .filter((c): c is Conversation => c !== null)
  },

  parseConversationDetail(
    data: unknown,
  ): { conversation: Conversation, messages: Message[] } | null {
    // Claude conversation detail format
    // { uuid, name, created_at, updated_at, chat_messages: [...] }
    const parsed = parseJsonIfString(data)
    if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
      log.warn('Invalid conversation detail data')
      return null
    }

    const item = parsed as Record<string, unknown>
    const base = (item.conversation || item.chat_conversation || item) as Record<string, unknown>
    const itemData = item.data as Record<string, unknown> | undefined
    const rawMessages
      = item.chat_messages
        || item.messages
        || item.items
        || item.message_history
        || itemData?.messages
        || itemData?.items
        || (Array.isArray(item) ? item : null)

    const messageList = normalizeMessageList(rawMessages)

    if (!messageList) {
      log.warn('No messages array in detail payload')
      return null
    }

    let originalId
      = base?.uuid
        || base?.id
        || base?.conversation_id
        || base?.conversationId
        || base?.chat_conversation_uuid

    const now = Date.now()
    const messages: Message[] = []
    let minCreatedAt = now
    let maxCreatedAt = 0

    for (const msg of messageList) {
      try {
        if (!msg || typeof msg !== 'object') continue
        const msgObj = msg as Record<string, unknown>
        const messageId
          = (msgObj.uuid as string) || (msgObj.id as string) || (msgObj.message_id as string)
        const role = extractRole(msg)
        const content = extractClaudeMessageContent(msg)
        if (!role || !content) continue

        if (!originalId) {
          const candidate = extractConversationIdFromMessage(msg)
          if (candidate) originalId = candidate
        }

        const createdAt = msgObj.created_at
          ? new Date(msgObj.created_at as string).getTime()
          : msgObj.createdAt
            ? new Date(msgObj.createdAt as string).getTime()
            : msgObj.timestamp
              ? new Date(msgObj.timestamp as string).getTime()
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
      }
      catch (e) {
        log.warn('Failed to parse message', e)
      }
    }

    if (!originalId || messages.length === 0) return null

    const titleSource = (base?.name as string | undefined) || (base?.title as string | undefined)
    const firstUserMessage = messages.find((m) => m.role === 'user')
    const title = titleSource || firstUserMessage?.content.slice(0, 80) || 'Untitled'

    const createdAt = base?.created_at
      ? new Date(base.created_at as string).getTime()
      : base?.createdAt
        ? new Date(base.createdAt as string).getTime()
        : minCreatedAt || now

    const updatedAt = base?.updated_at
      ? new Date(base.updated_at as string).getTime()
      : base?.updatedAt
        ? new Date(base.updatedAt as string).getTime()
        : maxCreatedAt || createdAt

    const conversation: Conversation = {
      id: `claude_${originalId}`,
      platform: 'claude',
      originalId: originalId as string,
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
      url: this.buildConversationUrl(originalId as string),
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
    url: string,
  ): { conversation: Conversation, messages: Message[] } | null {
    const payloads = extractSsePayloads(data)
    if (!payloads) return null

    const now = Date.now()
    let conversationId = this.extractConversationId(url) || ''
    let content = ''
    let messageId = ''
    let createdAt = now
    let title = ''

    for (const payload of payloads) {
      if (payload === '[DONE]') continue

      let eventData: Record<string, unknown> | null = null
      try {
        eventData = JSON.parse(payload) as Record<string, unknown>
      }
      catch {
        continue
      }

      if (eventData?.conversation_id) {
        conversationId = eventData.conversation_id as string
      }

      const msg = eventData?.message as Record<string, unknown> | undefined
      if (msg) {
        messageId = (msg.uuid as string) || (msg.id as string) || messageId
        if (msg.created_at) {
          createdAt = new Date(msg.created_at as string).getTime()
        }
        if (msg.name) {
          title = msg.name as string
        }
      }

      const chunk = extractClaudeContent(eventData)
      if (chunk) {
        const delta = eventData?.delta as Record<string, unknown> | undefined
        if (typeof eventData?.completion === 'string' || typeof delta?.text === 'string') {
          content += chunk
        }
        else if (chunk.length > content.length) {
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
