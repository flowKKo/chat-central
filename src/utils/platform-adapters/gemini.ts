import type { Conversation, Message } from '@/types'
import type { PlatformAdapter } from './types'

const API_PATTERNS = {
  batch: /\/_\/BardChatUi\/data\/batchexecute/,
  conversations: /\/conversations/,
}

const GEMINI_APP_URL = 'https://gemini.google.com/app/'
const CONVERSATION_ID_RE = /^c_[a-z0-9]+$/i
const RESPONSE_ID_RE = /^rc_[a-z0-9]+$/i
const RESPONSE_ID_SHORT_RE = /^r_[a-z0-9]+$/i

type WalkHandlers = {
  array?: (value: unknown[]) => boolean | void
  object?: (value: Record<string, unknown>) => boolean | void
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

function isResponseId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (RESPONSE_ID_RE.test(value) || RESPONSE_ID_SHORT_RE.test(value))
  )
}

function findTimestampInArray(value: unknown[]): number | null {
  let max: number | null = null
  for (const item of value) {
    const ts = toEpochMillis(item)
    if (!ts) continue
    max = max === null ? ts : Math.max(max, ts)
  }
  return max
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

  if (typeof value === 'number') {
    if (value > 1e12) return value
    if (value > 1e9) return value * 1000
    return null
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

function readTimestampFromObject(obj: Record<string, unknown>): number | null {
  return toEpochMillis(
    obj.timestamp ?? obj.createTime ?? obj.create_time ?? obj.time ?? obj.ct ?? obj.createdAt
  )
}

function extractMessageContent(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const record = item as Record<string, unknown>

  if (typeof record.text === 'string') return record.text
  if (typeof record.content === 'string') return record.content

  const content = record.content
  if (content && typeof content === 'object') {
    const contentRecord = content as Record<string, unknown>
    if (typeof contentRecord.text === 'string') return contentRecord.text
    if (Array.isArray(contentRecord.parts)) {
      return contentRecord.parts
        .filter((part): part is string => typeof part === 'string')
        .join('\n')
    }
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object') {
          const partRecord = part as Record<string, unknown>
          if (typeof partRecord.text === 'string') return partRecord.text
          if (partRecord.type === 'text' && typeof partRecord.text === 'string') {
            return partRecord.text
          }
        }
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
    const obj = value as Record<string, unknown>
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
  if (value.length < 3) return null
  if (!isConversationId(value[0])) return null
  const title = value[1]
  if (typeof title !== 'string' || !title) return null
  if (CONVERSATION_ID_RE.test(title) || RESPONSE_ID_RE.test(title) || RESPONSE_ID_SHORT_RE.test(title)) {
    return null
  }
  if (title.startsWith('http')) return null
  const createdAt = findTimestampInArray(value)
  if (!createdAt) return null
  return buildConversation(value[0], title, createdAt, now)
}

function parseConversationObject(obj: Record<string, unknown>, now: number): Conversation | null {
  const idValue = obj.conversationId ?? obj.id ?? obj.c
  const titleValue = obj.title ?? obj.t ?? obj.name
  if (typeof idValue !== 'string' || !idValue) return null
  if (typeof titleValue !== 'string' || !titleValue) return null
  const id = idValue
  const title = titleValue
  if (CONVERSATION_ID_RE.test(title) || RESPONSE_ID_RE.test(title) || RESPONSE_ID_SHORT_RE.test(title)) {
    return null
  }
  if (title.startsWith('http')) return null
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
  lastBaseTimestamp: number | null
  lastProducedTimestamp: number | null
  tieBreaker: number
  messages: Map<string, Message>
  earliestUserMessage: { content: string; timestamp: number } | null
}

function createDetailState(): DetailState {
  return {
    originalId: '',
    title: '',
    defaultTimestamp: null,
    lastBaseTimestamp: null,
    lastProducedTimestamp: null,
    tieBreaker: 0,
    messages: new Map<string, Message>(),
    earliestUserMessage: null,
  }
}

function normalizeMessageTimestamp(state: DetailState, candidate: number | null, now: number): number {
  if (candidate == null) {
    const base = state.defaultTimestamp ?? now
    const adjusted =
      state.lastProducedTimestamp !== null ? state.lastProducedTimestamp + 1 : base
    state.lastProducedTimestamp = adjusted
    state.lastBaseTimestamp = null
    state.tieBreaker = 0
    return adjusted
  }

  if (state.lastBaseTimestamp === candidate) {
    state.tieBreaker += 1
  } else {
    state.lastBaseTimestamp = candidate
    state.tieBreaker = 0
  }

  const adjusted = candidate + state.tieBreaker
  state.lastProducedTimestamp = adjusted
  return adjusted
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

function resolveUniqueMessageId(state: DetailState, baseId: string, content: string): string {
  const existing = state.messages.get(baseId)
  if (!existing || existing.content === content) return baseId
  let suffix = 1
  let candidate = `${baseId}_${suffix}`
  while (state.messages.has(candidate)) {
    suffix += 1
    candidate = `${baseId}_${suffix}`
  }
  return candidate
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

  const visit = (value: unknown, contextTimestamp: number | null): void => {
    if (!value) return

    if (Array.isArray(value)) {
      if (value.length === 2 && Array.isArray(value[0]) && Array.isArray(value[1])) {
        const wrapperTimestamp = toEpochMillis(value[1])
        if (wrapperTimestamp) {
          if (!state.defaultTimestamp) state.defaultTimestamp = wrapperTimestamp
          visit(value[0], wrapperTimestamp)
          return
        }
      }

      const localTimestamp = findTimestampInArray(value) ?? contextTimestamp
      if (localTimestamp && !state.defaultTimestamp) state.defaultTimestamp = localTimestamp

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
          const rawId = findMessageIdFromArray(value) || `user_${state.messages.size + 1}`
          const baseId = `gemini_${rawId}`
          const messageId = resolveUniqueMessageId(state, baseId, content)
          const createdAt = normalizeMessageTimestamp(state, localTimestamp, now)
          upsertMessage(state, {
            id: messageId,
            conversationId: '',
            role: 'user',
            content,
            createdAt,
          })
          // Track earliest user message for title (data may arrive in reverse order)
          const messageTimestamp = localTimestamp ?? createdAt
          if (
            !state.earliestUserMessage ||
            messageTimestamp < state.earliestUserMessage.timestamp
          ) {
            state.earliestUserMessage = { content, timestamp: messageTimestamp }
          }
        }
        return
      }

      if (typeof value[0] === 'string' && isResponseId(value[0]) && isStringArray(value[1])) {
        const content = value[1].join('\n').trim()
        if (content) {
          const createdAt = normalizeMessageTimestamp(state, localTimestamp, now)
          upsertMessage(state, {
            id: `gemini_${value[0]}`,
            conversationId: '',
            role: 'assistant',
            content,
            createdAt,
          })
        }
        return
      }

      for (const item of value) {
        visit(item, localTimestamp)
      }
      return
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>
      const convId =
        (obj.conversationId as string | undefined) ||
        (obj.conversation_id as string | undefined) ||
        (obj.cid as string | undefined) ||
        (isConversationId(obj.id) ? (obj.id as string) : null)
      if (convId && !state.originalId) state.originalId = normalizeConversationId(convId)

      if (!state.title && (obj.title || obj.name)) {
        state.title = String(obj.title || obj.name)
      }

      const objTimestamp = readTimestampFromObject(obj) ?? contextTimestamp
      if (objTimestamp && !state.defaultTimestamp) state.defaultTimestamp = objTimestamp

      const content = extractMessageContent(obj)
      if (content && obj.author) {
        const role = obj.author === 'user' || obj.author === '0' ? 'user' : 'assistant'
        const createdAt = normalizeMessageTimestamp(state, objTimestamp, now)
        const rawId = (obj.id as string) || (obj.messageId as string) || `${createdAt}_${state.messages.size + 1}`
        const resolvedId =
          role === 'user'
            ? resolveUniqueMessageId(state, `gemini_${rawId}`, content)
            : `gemini_${rawId}`
        upsertMessage(state, {
          id: resolvedId,
          conversationId: '',
          role,
          content,
          createdAt,
          _raw: obj,
        })
        // Track earliest user message for title (data may arrive in reverse order)
        if (role === 'user') {
          const messageTimestamp = objTimestamp ?? createdAt
          if (
            !state.earliestUserMessage ||
            messageTimestamp < state.earliestUserMessage.timestamp
          ) {
            state.earliestUserMessage = { content, timestamp: messageTimestamp }
          }
        }
      }

      for (const item of Object.values(obj)) {
        visit(item, objTimestamp)
      }
      return
    }

    if (typeof value === 'string') {
      if (!state.originalId && isConversationId(value)) {
        state.originalId = normalizeConversationId(value)
      }
      if (value.startsWith('[') || value.startsWith('{')) {
        const parsed = parseJsonSafe(value)
        if (parsed) visit(parsed, contextTimestamp)
      }
    }
  }

  visit(payload, null)

  if (!state.originalId || state.messages.size === 0) return null

  const conversationId = state.originalId
  const messagePrefix = `gemini_${conversationId}_`
  const messages = Array.from(state.messages.values())
    .map((message) => {
      const existingId = message.id.startsWith(messagePrefix)
        ? message.id
        : `${messagePrefix}${message.id.replace(/^gemini_/, '')}`
      return { ...message, id: existingId, conversationId: `gemini_${conversationId}` }
    })
    .sort((a, b) => a.createdAt - b.createdAt)

  const createdAt = state.defaultTimestamp ?? messages[0]?.createdAt ?? now
  const firstUserMessage = messages.find((m) => m.role === 'user')
  const preview = firstUserMessage?.content || messages[0]?.content || ''
  // Use earliest user message for title, falling back to sorted messages or object title
  const title =
    state.earliestUserMessage?.content.slice(0, 80) ||
    firstUserMessage?.content.slice(0, 80) ||
    state.title ||
    'Gemini Chat'

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

    const mergeConversationMeta = (current: Conversation, incoming: Conversation): Conversation => {
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
      conversation = conversation ? mergeConversationMeta(conversation, result.conversation) : result.conversation
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
