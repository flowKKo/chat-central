import { defineBackground } from 'wxt/sandbox'
import { browser } from 'wxt/browser'
import { getAdapterForUrl, type PlatformAdapter } from '@/utils/platform-adapters'
import {
  upsertConversation,
  upsertConversations,
  upsertMessages,
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

  await upsertConversations(conversations)

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

  await upsertConversation(conversation)
  if (messages.length > 0) {
    await upsertMessages(messages)
  }

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
  await upsertConversation(conversation)
  if (messages.length > 0) {
    await upsertMessages(messages)
  }

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
    await upsertConversations(list)
    return { success: true, count: list.length }
  }

  const detail = adapter.parseConversationDetail(data)
  if (detail) {
    await upsertConversation(detail.conversation)
    if (detail.messages.length > 0) {
      await upsertMessages(detail.messages)
    }
    return { success: true, count: detail.messages.length }
  }

  if (adapter.parseStreamResponse) {
    const stream = adapter.parseStreamResponse(data, url)
    if (stream) {
      await upsertConversation(stream.conversation)
      if (stream.messages.length > 0) {
        await upsertMessages(stream.messages)
      }
      return { success: true, count: stream.messages.length }
    }
  }

  return { success: false, count: 0 }
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