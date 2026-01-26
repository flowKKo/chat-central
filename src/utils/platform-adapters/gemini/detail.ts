import type { Conversation, Message } from '@/types'
import {
  parseJsonSafe,
  toEpochMillis,
  readTimestampFromObject,
  extractMessageContent,
} from '../common'
import type { DetailState } from './types'
import { CONVERSATION_ID_RE, GEMINI_APP_URL, RESPONSE_ID_RE } from './constants'
import {
  findTimestampInArray,
  isConversationId,
  isResponseId,
  isStringArray,
  normalizeConversationId,
} from './utils'

/**
 * Create initial detail parsing state
 */
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

/**
 * Normalize message timestamp to ensure uniqueness
 */
function normalizeMessageTimestamp(
  state: DetailState,
  candidate: number | null,
  now: number,
): number {
  if (candidate == null) {
    const base = state.defaultTimestamp ?? now
    const adjusted = state.lastProducedTimestamp !== null ? state.lastProducedTimestamp + 1 : base
    state.lastProducedTimestamp = adjusted
    state.lastBaseTimestamp = null
    state.tieBreaker = 0
    return adjusted
  }

  if (state.lastBaseTimestamp === candidate) {
    state.tieBreaker += 1
  }
  else {
    state.lastBaseTimestamp = candidate
    state.tieBreaker = 0
  }

  const adjusted = candidate + state.tieBreaker
  state.lastProducedTimestamp = adjusted
  return adjusted
}

/**
 * Upsert a message into state, merging if exists
 */
function upsertMessage(state: DetailState, message: Message): void {
  const existing = state.messages.get(message.id)
  if (!existing) {
    state.messages.set(message.id, message)
    return
  }

  const content
    = message.content.length >= existing.content.length ? message.content : existing.content
  const createdAt = Math.min(existing.createdAt, message.createdAt)
  state.messages.set(message.id, { ...existing, ...message, content, createdAt })
}

/**
 * Resolve a unique message ID to avoid collisions
 */
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

/**
 * Find message ID from array data
 */
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

/**
 * Parse conversation detail from a single payload
 */
export function parseConversationDetailPayload(
  payload: unknown,
  now: number,
): { conversation: Conversation, messages: Message[] } | null {
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
          const messageTimestamp = localTimestamp ?? createdAt
          if (
            !state.earliestUserMessage
            || messageTimestamp < state.earliestUserMessage.timestamp
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
      const convId
        = (obj.conversationId as string | undefined)
          || (obj.conversation_id as string | undefined)
          || (obj.cid as string | undefined)
          || (isConversationId(obj.id) ? (obj.id as string) : null)
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
        const rawId
          = (obj.id as string)
            || (obj.messageId as string)
            || `${createdAt}_${state.messages.size + 1}`
        const resolvedId
          = role === 'user'
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
        if (role === 'user') {
          const messageTimestamp = objTimestamp ?? createdAt
          if (
            !state.earliestUserMessage
            || messageTimestamp < state.earliestUserMessage.timestamp
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
  const title
    = state.earliestUserMessage?.content.slice(0, 80)
      || firstUserMessage?.content.slice(0, 80)
      || state.title
      || 'Gemini Chat'

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
