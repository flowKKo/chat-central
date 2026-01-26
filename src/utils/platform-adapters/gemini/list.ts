import { readTimestampFromObject } from '../common'
import {
  GEMINI_APP_URL,
  CONVERSATION_ID_RE,
  RESPONSE_ID_RE,
  RESPONSE_ID_SHORT_RE,
} from './constants'
import { normalizeConversationId, isConversationId, findTimestampInArray, walk } from './utils'
import type { Conversation } from '@/types'

/**
 * Build a conversation object from parsed data
 */
export function buildConversation(
  id: string,
  title: string,
  createdAt: number,
  now: number,
): Conversation {
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

/**
 * Parse a conversation list item from array format
 */
function parseConversationListItem(value: unknown, now: number): Conversation | null {
  if (!Array.isArray(value)) return null
  if (value.length < 3) return null
  if (!isConversationId(value[0])) return null
  const title = value[1]
  if (typeof title !== 'string' || !title) return null
  if (
    CONVERSATION_ID_RE.test(title)
    || RESPONSE_ID_RE.test(title)
    || RESPONSE_ID_SHORT_RE.test(title)
  ) {
    return null
  }
  if (title.startsWith('http')) return null
  const createdAt = findTimestampInArray(value)
  if (!createdAt) return null
  return buildConversation(value[0], title, createdAt, now)
}

/**
 * Parse a conversation from object format
 */
function parseConversationObject(obj: Record<string, unknown>, now: number): Conversation | null {
  const idValue = obj.conversationId ?? obj.id ?? obj.c
  const titleValue = obj.title ?? obj.t ?? obj.name
  if (typeof idValue !== 'string' || !idValue) return null
  if (typeof titleValue !== 'string' || !titleValue) return null
  const id = idValue
  const title = titleValue
  if (
    CONVERSATION_ID_RE.test(title)
    || RESPONSE_ID_RE.test(title)
    || RESPONSE_ID_SHORT_RE.test(title)
  ) {
    return null
  }
  if (title.startsWith('http')) return null
  const createdAt = readTimestampFromObject(obj) ?? now
  return buildConversation(id, title, createdAt, now)
}

/**
 * Parse conversation list from a payload
 */
export function parseConversationListPayload(payload: unknown, now: number): Conversation[] {
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
