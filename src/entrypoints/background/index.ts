import { defineBackground } from 'wxt/sandbox'
import { browser } from 'wxt/browser'
import { getAdapterForUrl, type PlatformAdapter } from '@/utils/platform-adapters'
import {
  upsertConversation,
  upsertMessages,
  getConversationById,
  getExistingMessageIds,
  getConversations,
  getMessagesByConversationId,
  getDBStats,
} from '@/utils/db'
import type { Conversation, Message, Platform } from '@/types'

export default defineBackground({
  type: 'module',

  main() {
    console.log('[ChatCentral] Background service worker started')

    // Handle messages from content script
    browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      handleMessage(message)
        .then(sendResponse)
        .catch((e) => {
          console.error('[ChatCentral] Message handler error:', e)
          sendResponse({ error: e.message })
        })
      return true // Keep message channel open to support asynchronous response
    })

    // Handle extension install/update
    browser.runtime.onInstalled.addListener((details: { reason: string }) => {
      if (details.reason === 'install') {
        console.log('[ChatCentral] Extension installed')
        // Open welcome page here
      } else if (details.reason === 'update') {
        console.log('[ChatCentral] Extension updated')
      }
    })
  },
})

/**
 * Message handler router
 */
async function handleMessage(message: any): Promise<any> {
  const { action } = message

  switch (action) {
    case 'CAPTURE_API_RESPONSE':
      return handleCapturedResponse(message)

    case 'GET_CONVERSATIONS':
      return handleGetConversations(message)

    case 'GET_MESSAGES':
      return handleGetMessages(message)

    case 'GET_STATS':
      return handleGetStats()

    case 'SEARCH':
      return handleSearch(message)

    default:
      console.warn('[ChatCentral] Unknown action:', action)
      return { error: 'Unknown action' }
  }
}

/**
 * Handle captured API response
 */
async function handleCapturedResponse(message: {
  url: string
  data: unknown
  timestamp: number
}): Promise<{ success: boolean; count?: number }> {
  const { url, data } = message

  const adapter = getAdapterForUrl(url)
  if (!adapter) {
    console.warn('[ChatCentral] No adapter found for URL:', url)
    return { success: false }
  }

  const endpointType = adapter.getEndpointType(url)
  console.log(`[ChatCentral] Processing ${adapter.platform} ${endpointType} response`)

  try {
    switch (endpointType) {
      case 'list':
        return await processConversationList(adapter, data)

      case 'detail':
        return await processConversationDetail(adapter, data)

      case 'stream':
        return await processStreamResponse(adapter, data, url)

      default:
        console.warn('[ChatCentral] Unknown endpoint type:', endpointType)
        return await processUnknownResponse(adapter, data, url)
    }
  } catch (e) {
    console.error('[ChatCentral] Failed to process response:', e)
    return { success: false }
  }
}

/**
 * Process conversation list response
 */
async function processConversationList(
  adapter: PlatformAdapter,
  data: unknown
): Promise<{ success: boolean; count: number }> {
  const conversations = adapter.parseConversationList(data)

  if (conversations.length === 0) {
    console.log('[ChatCentral] No conversations parsed from list')
    return { success: true, count: 0 }
  }

  console.log(`[ChatCentral] Parsed ${conversations.length} conversations from ${adapter.platform}`)

  for (const conversation of conversations) {
    await upsertConversationMerged(conversation)
  }

  return { success: true, count: conversations.length }
}

/**
 * Process conversation detail response
 */
async function processConversationDetail(
  adapter: PlatformAdapter,
  data: unknown
): Promise<{ success: boolean; count: number }> {
  const result = adapter.parseConversationDetail(data)

  if (!result) {
    console.log('[ChatCentral] Failed to parse conversation detail')
    return { success: false, count: 0 }
  }

  const { conversation, messages } = result

  console.log(
    `[ChatCentral] Parsed conversation "${conversation.title}" with ${messages.length} messages`
  )

  await applyConversationUpdate(conversation, messages, 'full')

  return { success: true, count: messages.length }
}

/**
 * Process stream response
 */
async function processStreamResponse(
  adapter: PlatformAdapter,
  data: unknown,
  url: string
): Promise<{ success: boolean; count: number }> {
  if (!adapter.parseStreamResponse) {
    console.log('[ChatCentral] Stream response not supported for adapter')
    return { success: false, count: 0 }
  }

  const result = adapter.parseStreamResponse(data, url)
  if (!result) {
    console.log('[ChatCentral] Failed to parse stream response')
    return { success: false, count: 0 }
  }

  const { conversation, messages } = result
  await applyConversationUpdate(conversation, messages, 'partial')

  return { success: true, count: messages.length }
}

/**
 * Process unknown type response (fallback)
 */
async function processUnknownResponse(
  adapter: PlatformAdapter,
  data: unknown,
  url: string
): Promise<{ success: boolean; count: number }> {
  const list = adapter.parseConversationList(data)
  if (list.length > 0) {
    for (const conversation of list) {
      await upsertConversationMerged(conversation)
    }
    return { success: true, count: list.length }
  }

  const detail = adapter.parseConversationDetail(data)
  if (detail) {
    await applyConversationUpdate(detail.conversation, detail.messages, 'full')
    return { success: true, count: detail.messages.length }
  }

  if (adapter.parseStreamResponse) {
    const stream = adapter.parseStreamResponse(data, url)
    if (stream) {
      await applyConversationUpdate(stream.conversation, stream.messages, 'partial')
      return { success: true, count: stream.messages.length }
    }
  }

  return { success: false, count: 0 }
}

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

function mergeConversation(existing: Conversation, incoming: Conversation): Conversation {
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

  const title = incoming.title || existing.title
  const preview =
    incomingIsNewer && incoming.preview ? incoming.preview : existing.preview || incoming.preview
  const messageCount = Math.max(existing.messageCount, incoming.messageCount)

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
    url: existing.url ?? incoming.url,
  }
}

async function upsertConversationMerged(conversation: Conversation): Promise<void> {
  const existing = await getConversationById(conversation.id)
  if (!existing) {
    await upsertConversation(conversation)
    return
  }

  await upsertConversation(mergeConversation(existing, conversation))
}

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

async function applyConversationUpdate(
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

  const existingIds =
    mode === 'partial'
      ? await getExistingMessageIds(messages.map((message) => message.id))
      : undefined

  await upsertMessages(messages)
  await updateConversationFromMessages(conversation.id, messages, { mode, existingIds })
}

/**
 * Get conversation list
 */
async function handleGetConversations(message: {
  platform?: Platform
  limit?: number
  offset?: number
}): Promise<{ conversations: Conversation[] }> {
  const { platform, limit, offset } = message
  const conversations = await getConversations({ platform, limit, offset })
  return { conversations }
}

/**
 * Get conversation messages
 */
async function handleGetMessages(message: {
  conversationId: string
}): Promise<{ messages: Message[] }> {
  const { conversationId } = message
  const messages = await getMessagesByConversationId(conversationId)
  return { messages }
}

/**
 * Get statistics
 */
async function handleGetStats() {
  const stats = await getDBStats()
  return { stats }
}

/**
 * Search conversations
 */
async function handleSearch(message: { query: string; filters?: any }) {
  // Simple implementation, can use MiniSearch for enhancement later
  const { query } = message
  const conversations = await getConversations({ limit: 100 })

  const lowerQuery = query.toLowerCase()
  const results = conversations.filter(
    (c) => c.title.toLowerCase().includes(lowerQuery) || c.preview.toLowerCase().includes(lowerQuery)
  )

  return { results }
}
