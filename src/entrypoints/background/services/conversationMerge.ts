import type { Conversation, Message } from '@/types'
import {
  upsertConversation,
  upsertMessages,
  getConversationById,
  getExistingMessageIds,
  getMessagesByIds,
} from '@/utils/db'
import { dedupeMessagesByContent } from '@/utils/message-dedupe'

type DetailStatus = 'none' | 'partial' | 'full'

function rankDetailStatus(status: DetailStatus): number {
  switch (status) {
    case 'full':
      return 2
    case 'partial':
      return 1
    default:
      return 0
  }
}

/**
 * Merge two conversations, preserving important fields from both
 */
export function mergeConversation(existing: Conversation, incoming: Conversation): Conversation {
  const incomingIsNewer = incoming.updatedAt > existing.updatedAt
  const existingRank = rankDetailStatus(existing.detailStatus)
  const incomingRank = rankDetailStatus(incoming.detailStatus)
  let detailStatus = incomingRank >= existingRank ? incoming.detailStatus : existing.detailStatus
  let detailSyncedAt =
    incomingRank >= existingRank
      ? Math.max(existing.detailSyncedAt ?? 0, incoming.detailSyncedAt ?? 0) || null
      : existing.detailSyncedAt ?? null

  if (incomingIsNewer && existing.detailStatus === 'full' && incomingRank < existingRank) {
    detailStatus = 'partial'
    detailSyncedAt = existing.detailSyncedAt ?? null
  }

  const shouldKeepExistingTitle = (() => {
    if (existing.platform !== 'gemini') return false
    if (!existing.title || !incoming.title) return false
    if (existing.title === incoming.title) return false
    const incomingTitle = incoming.title.trim()
    const incomingPreview = incoming.preview.trim()
    if (!incomingTitle) return true
    if (/^(?:r|rc|c)_[a-z0-9]+$/i.test(incomingTitle)) return true
    if (!incomingPreview) return false
    const normalizedTitle = incomingTitle.replace(/\s+/g, ' ')
    const normalizedPreview = incomingPreview.replace(/\s+/g, ' ')
    if (normalizedPreview.startsWith(normalizedTitle)) return true
    if (normalizedTitle.startsWith(normalizedPreview)) return true
    if (normalizedTitle.length <= 6) return true
    return false
  })()

  let title = existing.title || incoming.title
  if (incoming.title && (!existing.title || !shouldKeepExistingTitle)) {
    title = incoming.title
  }
  const preview =
    incomingIsNewer && incoming.preview ? incoming.preview : existing.preview || incoming.preview
  const messageCount = Math.max(existing.messageCount, incoming.messageCount)
  const isFavorite = existing.isFavorite || incoming.isFavorite
  let favoriteAt = existing.favoriteAt ?? null

  if (!existing.isFavorite && incoming.isFavorite) {
    favoriteAt = incoming.favoriteAt ?? Date.now()
  } else if (!isFavorite) {
    favoriteAt = null
  }

  return {
    ...existing,
    ...incoming,
    title,
    preview,
    messageCount,
    createdAt: Math.min(existing.createdAt, incoming.createdAt),
    updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
    syncedAt: Math.max(existing.syncedAt, incoming.syncedAt),
    detailStatus,
    detailSyncedAt,
    isFavorite,
    favoriteAt,
    url: existing.url ?? incoming.url,
  }
}

/**
 * Upsert a conversation, merging with existing if present
 */
export async function upsertConversationMerged(conversation: Conversation): Promise<void> {
  const existing = await getConversationById(conversation.id)
  if (!existing) {
    await upsertConversation(conversation)
    return
  }

  await upsertConversation(mergeConversation(existing, conversation))
}

/**
 * Update conversation metadata based on messages
 */
async function updateConversationFromMessages(
  conversationId: string,
  messages: Message[],
  options: { mode: 'full' | 'partial'; existingIds?: Set<string> }
): Promise<void> {
  const existing = await getConversationById(conversationId)
  if (!existing) return

  const sortedMessages = [...messages].sort((a, b) => a.createdAt - b.createdAt)
  let existingIds = options.existingIds
  let newMessages = messages
  let newCount = messages.length
  if (options.mode === 'partial') {
    if (!existingIds) {
      existingIds = await getExistingMessageIds(messages.map((message) => message.id))
    }
    const knownIds = existingIds ?? new Set<string>()
    newMessages = messages.filter((message) => !knownIds.has(message.id))
    newCount = newMessages.length
  }

  const maxCreatedAt = messages.reduce((acc, message) => Math.max(acc, message.createdAt), 0)
  const updatedAt = Math.max(existing.updatedAt, maxCreatedAt || existing.updatedAt)

  let preview = existing.preview
  if (options.mode === 'full') {
    const firstUser = sortedMessages.find((message) => message.role === 'user')
    preview = (firstUser?.content || sortedMessages[0]?.content || preview).slice(0, 200)
  } else {
    const latestUserMessage = [...newMessages].reverse().find((message) => message.role === 'user')
    if (latestUserMessage) {
      preview = latestUserMessage.content.slice(0, 200)
    }
  }

  const messageCount =
    options.mode === 'full' ? messages.length : existing.messageCount + newCount

  await upsertConversation({
    ...existing,
    updatedAt,
    preview,
    messageCount,
  })
}

/**
 * Dedupe Gemini messages that may have duplicate IDs
 */
async function ensureUniqueGeminiMessages(
  conversation: Conversation,
  messages: Message[]
): Promise<Message[]> {
  if (conversation.platform !== 'gemini') return messages

  const ids = messages.map((message) => message.id)
  const existing = await getMessagesByIds(ids)
  return dedupeMessagesByContent(messages, existing)
}

/**
 * Apply a conversation update with messages
 */
export async function applyConversationUpdate(
  conversation: Conversation,
  messages: Message[],
  mode: 'full' | 'partial'
): Promise<void> {
  await upsertConversationMerged({
    ...conversation,
    detailStatus: mode === 'full' ? 'full' : 'partial',
    detailSyncedAt: Date.now(),
  })

  if (messages.length === 0) return

  const normalizedMessages = await ensureUniqueGeminiMessages(conversation, messages)

  const existingIds =
    mode === 'partial'
      ? await getExistingMessageIds(normalizedMessages.map((message) => message.id))
      : undefined

  await upsertMessages(normalizedMessages)
  await updateConversationFromMessages(conversation.id, normalizedMessages, { mode, existingIds })
}
