import type { Conversation, Message } from '@/types'
import type { PlatformAdapter } from './types'

const API_PATTERNS = {
  batch: /\/_\/BardChatUi\/data\/batchexecute/,
  conversations: /\/conversations/,
}

const GEMINI_APP_URL = 'https://gemini.google.com/app/'
const CONVERSATION_ID_RE = /^c_[a-z0-9]+$/i
const RESPONSE_ID_RE = /^rc_[a-z0-9]+$/i

type WalkHandlers = {
  array?: (value: unknown[]) => boolean | void
  object?: (value: Record<string, any>) => boolean | void
  string?: (value: string) => boolean | void
}

function stripXssiPrefix(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith("))}'")) return trimmed
  const newlineIndex = trimmed.indexOf('\n')
  if (newlineIndex === -1) return ''
  return trimmed.slice(newlineIndex + 1).trimStart()
}

function parseJsonSafe(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function parseJsonCandidates(text: string): unknown[] {
  const results: unknown[] = []
  const direct = parseJsonSafe(text)
  if (direct) return [direct]

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const parsed = parseJsonSafe(line)
    if (parsed) results.push(parsed)
  }

  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start !== -1 && end > start) {
    const parsed = parseJsonSafe(text.slice(start, end + 1))
    if (parsed) results.push(parsed)
  }

  return results
}

function normalizePayloads(data: unknown): unknown[] {
  if (Array.isArray(data) || (data && typeof data === 'object')) return [data]
  if (typeof data !== 'string') return []

  const text = stripXssiPrefix(data)
  if (!text) return []
  return parseJsonCandidates(text)
}

function extractWrbPayloads(payloads: unknown[]): unknown[] {
  const results: unknown[] = []

  const visit = (value: unknown) => {
    if (!value) return

    if (Array.isArray(value)) {
      if (value.length >= 3 && value[0] === 'wrb.fr' && typeof value[2] === 'string') {
        const parsed = parseJsonSafe(value[2] as string)
        if (parsed) results.push(parsed)
        return
      }

      for (const item of value) {
        visit(item)
      }
      return
    }

    if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
      const parsed = parseJsonSafe(value)
      if (parsed) visit(parsed)
    }
  }

  for (const payload of payloads) {
    visit(payload)
  }

  return results
}

function getPayloadSources(data: unknown): unknown[] {
  const payloads = normalizePayloads(data)
  const wrbPayloads = extractWrbPayloads(payloads)
  return wrbPayloads.length > 0 ? wrbPayloads : payloads
}

function normalizeConversationId(id: string): string {
  return id.startsWith('c_') ? id.slice(2) : id
}

function isConversationId(value: unknown): value is string {
  return typeof value === 'string' && CONVERSATION_ID_RE.test(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function toEpochMillis(value: unknown): number | null {
  if (Array.isArray(value) && value.length === 2) {
    const [seconds, nanos] = value
    if (typeof seconds !== 'number' || typeof nanos !== 'number') return null
    if (seconds < 1e9 || seconds > 1e11) return null
    return seconds * 1000 + Math.floor(nanos / 1e6)
  }

  if (typeof value === 'number') return value > 1e12 ? value : value * 1000
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

function readTimestampFromObject(obj: Record<string, any>): number | null {
  return toEpochMillis(
    obj.timestamp ?? obj.createTime ?? obj.create_time ?? obj.time ?? obj.ct ?? obj.createdAt
  )
}

function extractMessageContent(item: any): string {
  if (!item) return ''
  if (typeof item.text === 'string') return item.text
  if (typeof item.content === 'string') return item.content
  if (typeof item.content?.text === 'string') return item.content.text
  if (Array.isArray(item.content?.parts)) {
    return item.content.parts.filter((part: any) => typeof part === 'string').join('\n')
  }
  if (Array.isArray(item.content)) {
    return item.content
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (part && typeof part.text === 'string') return part.text
        if (part?.type === 'text') return part.text
        return ''
      })
      .join('\n')
  }
  return ''
}

function walk(value: unknown, handlers: WalkHandlers): void {
  if (!value) return

  if (Array.isArray(value)) {
    const skip = handlers.array?.(value)
    if (skip) return
    for (const item of value) {
      walk(item, handlers)
    }
    return
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, any>
    const skip = handlers.object?.(obj)
    if (skip) return
    for (const item of Object.values(obj)) {
      walk(item, handlers)
    }
    return
  }

  if (typeof value === 'string') {
    const skip = handlers.string?.(value)
    if (skip) return
    if (value.startsWith('[') || value.startsWith('{')) {
      const parsed = parseJsonSafe(value)
      if (parsed) walk(parsed, handlers)
    }
  }
}

function buildConversation(id: string, title: string, createdAt: number, now: number): Conversation {
  const normalizedId = normalizeConversationId(id)
  const timestamp = createdAt || now
  return {
    id: `gemini_${normalizedId}`,
    platform: 'gemini' as const,
    originalId: normalizedId,
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    messageCount: 0,
    preview: '',
    tags: [],
    syncedAt: now,
    detailStatus: 'none',
    detailSyncedAt: null,
    isFavorite: false,
    favoriteAt: null,
    url: `${GEMINI_APP_URL}${normalizedId}`,
  }
}

function parseConversationListItem(value: unknown, now: number): Conversation | null {
  if (!Array.isArray(value)) return null
  if (!isConversationId(value[0]) || typeof value[1] !== 'string') return null
  const createdAt = toEpochMillis(value[5]) ?? now
  return buildConversation(value[0], value[1], createdAt, now)
}

function parseConversationObject(obj: Record<string, any>, now: number): Conversation | null {
  const id = obj.conversationId || obj.id || obj.c
  const title = obj.title || obj.t || obj.name
  if (!id || !title) return null
  const createdAt = readTimestampFromObject(obj) ?? now
  return buildConversation(id, title, createdAt, now)
}

function parseConversationListPayload(payload: unknown, now: number): Conversation[] {
  const conversations = new Map<string, Conversation>()

  const upsert = (conversation: Conversation) => {
    const existing = conversations.get(conversation.id)
    if (!existing || existing.updatedAt < conversation.updatedAt) {
      conversations.set(conversation.id, conversation)
    }
  }

  walk(payload, {
    array: (value) => {
      const conversation = parseConversationListItem(value, now)
      if (conversation) {
        upsert(conversation)
        return true
      }
      return false
    },
    object: (obj) => {
      const conversation = parseConversationObject(obj, now)
      if (conversation) upsert(conversation)
      return false
    },
  })

  return Array.from(conversations.values())
}

type DetailState = {
  originalId: string
  title: string
  defaultTimestamp: number | null
  messages: Map<string, Message>
}

function createDetailState(): DetailState {
  return {
    originalId: '',
    title: '',
    defaultTimestamp: null,
    messages: new Map<string, Message>(),
  }
}

function upsertMessage(state: DetailState, message: Message): void {
  const existing = state.messages.get(message.id)
  if (!existing) {
    state.messages.set(message.id, message)
    return
  }

  const content = message.content.length >= existing.content.length ? message.content : existing.content
  const createdAt = Math.min(existing.createdAt, message.createdAt)
  state.messages.set(message.id, { ...existing, ...message, content, createdAt })
}

function findMessageIdFromArray(arr: unknown[]): string | null {
  for (const item of arr) {
    if (typeof item === 'string') {
      if (CONVERSATION_ID_RE.test(item) || RESPONSE_ID_RE.test(item)) continue
      if (item.startsWith('r_')) continue
      if (/^[a-f0-9]{12,}$/i.test(item)) return item
    }
  }
  return null
}

function parseConversationDetailPayload(payload: unknown, now: number) {
  const state = createDetailState()

  walk(payload, {
    array: (value) => {
      const ts = toEpochMillis(value)
      if (ts && !state.defaultTimestamp) state.defaultTimestamp = ts

      if (!state.originalId) {
        for (const item of value) {
          if (isConversationId(item)) {
            state.originalId = normalizeConversationId(item)
            break
          }
        }
      }

      if (value.length >= 2 && isStringArray(value[0]) && typeof value[1] === 'number') {
        const content = value[0].join('\n').trim()
        if (content) {
          const messageId = findMessageIdFromArray(value) || `gemini_user_${state.messages.size + 1}`
          const createdAt = state.defaultTimestamp ?? now
          upsertMessage(state, {
            id: `gemini_${messageId}`,
            conversationId: '',
            role: 'user',
            content,
            createdAt,
          })
          if (!state.title) state.title = content.slice(0, 80)
        }
        return true
      }

      if (typeof value[0] === 'string' && RESPONSE_ID_RE.test(value[0]) && isStringArray(value[1])) {
        const content = value[1].join('\n').trim()
        if (content) {
          const createdAt = state.defaultTimestamp ?? now
          upsertMessage(state, {
            id: `gemini_${value[0]}`,
            conversationId: '',
            role: 'assistant',
            content,
            createdAt,
          })
        }
        return true
      }

      return false
    },
    object: (obj) => {
      const convId =
        obj.conversationId || obj.conversation_id || obj.cid || (isConversationId(obj.id) ? obj.id : null)
      if (convId && !state.originalId) state.originalId = normalizeConversationId(convId)

      if (!state.title && (obj.title || obj.name)) {
        state.title = obj.title || obj.name
      }

      const content = extractMessageContent(obj)
      if (content && obj.author) {
        const role = obj.author === 'user' || obj.author === '0' ? 'user' : 'assistant'
        const createdAt = readTimestampFromObject(obj) ?? state.defaultTimestamp ?? now
        const rawId = obj.id || obj.messageId || `${createdAt}_${state.messages.size + 1}`
        upsertMessage(state, {
          id: `gemini_${rawId}`,
          conversationId: '',
          role,
          content,
          createdAt,
          _raw: obj,
        })
        if (role === 'user' && !state.title) state.title = content.slice(0, 80)
      }

      return false
    },
    string: (value) => {
      if (!state.originalId && isConversationId(value)) {
        state.originalId = normalizeConversationId(value)
      }
      return false
    },
  })

  if (!state.originalId || state.messages.size === 0) return null

  const conversationId = state.originalId
  const messages = Array.from(state.messages.values())
    .map((message) => ({ ...message, conversationId: `gemini_${conversationId}` }))
    .sort((a, b) => a.createdAt - b.createdAt)

  const createdAt = state.defaultTimestamp ?? messages[0]?.createdAt ?? now
  const preview = messages.find((m) => m.role === 'user')?.content || messages[0]?.content || ''
  const title = state.title || preview.slice(0, 80) || 'Gemini Chat'

  return {
    conversation: {
      id: `gemini_${conversationId}`,
      platform: 'gemini' as const,
      originalId: conversationId,
      title,
      createdAt,
      updatedAt: messages[messages.length - 1]?.createdAt ?? createdAt,
      messageCount: messages.length,
      preview: preview.slice(0, 200),
      tags: [],
      syncedAt: now,
      detailStatus: 'full' as const,
      detailSyncedAt: now,
      isFavorite: false,
      favoriteAt: null,
      url: `${GEMINI_APP_URL}${conversationId}`,
    },
    messages,
  }
}

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

  parseConversationDetail(data: unknown): { conversation: Conversation; messages: Message[] } | null {
    const sources = getPayloadSources(data)
    if (sources.length === 0) {
      console.warn('[ChatCentral] Gemini: No detail data received')
      return null
    }

    const now = Date.now()
    for (const payload of sources) {
      const result = parseConversationDetailPayload(payload, now)
      if (result) return result
    }

    return null
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
