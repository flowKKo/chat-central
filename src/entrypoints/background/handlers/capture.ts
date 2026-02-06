import { getAdapterForUrl, type PlatformAdapter } from '@/utils/platform-adapters'
import { createLogger } from '@/utils/logger'
import { CaptureApiResponseSchema, type CaptureApiResponseMessage } from '../schemas'
import { applyConversationUpdate, upsertConversationsMerged } from '../services'
import { notifyExtensionPages } from './utils'

const log = createLogger('ChatCentral')

/**
 * Notify extension pages that a conversation's detail was synced
 */
function notifyConversationSynced(conversationId: string): void {
  notifyExtensionPages('CONVERSATION_DETAIL_SYNCED', { conversationId })
}

/**
 * Handle captured API response from content script
 */
export async function handleCapturedResponse(
  rawMessage: unknown
): Promise<{ success: boolean; count?: number; error?: string }> {
  const parseResult = CaptureApiResponseSchema.safeParse(rawMessage)
  if (!parseResult.success) {
    log.warn('Invalid capture message:', parseResult.error.message)
    return { success: false, error: 'Invalid message format' }
  }

  const message: CaptureApiResponseMessage = parseResult.data
  const { url, data } = message

  const adapter = getAdapterForUrl(url)
  if (!adapter) {
    log.warn('No adapter found for URL:', url)
    return { success: false }
  }

  const endpointType = adapter.getEndpointType(url)
  log.info(`Processing ${adapter.platform} ${endpointType} response`)

  try {
    switch (endpointType) {
      case 'list':
        return await processConversationList(adapter, data)

      case 'detail':
        return await processConversationDetail(adapter, data)

      case 'stream':
        return await processStreamResponse(adapter, data, url)

      default:
        log.warn('Unknown endpoint type:', endpointType)
        return await processUnknownResponse(adapter, data, url)
    }
  } catch (e) {
    log.error('Failed to process response:', e)
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
    log.info('No conversations parsed from list')
    return { success: true, count: 0 }
  }

  log.info(`Parsed ${conversations.length} conversations from ${adapter.platform}`)

  // Batch upsert for better performance
  await upsertConversationsMerged(conversations)

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
    log.info('Failed to parse conversation detail')
    return { success: false, count: 0 }
  }

  const { conversation, messages } = result

  log.info(`Parsed conversation "${conversation.title}" with ${messages.length} messages`)

  await applyConversationUpdate(conversation, messages, 'full')
  notifyConversationSynced(conversation.id)

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
    log.info('Stream response not supported for adapter')
    return { success: false, count: 0 }
  }

  const result = adapter.parseStreamResponse(data, url)
  if (!result) {
    log.info('Failed to parse stream response')
    return { success: false, count: 0 }
  }

  const { conversation, messages } = result
  await applyConversationUpdate(conversation, messages, 'partial')
  notifyConversationSynced(conversation.id)

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
  let handled = false
  let count = 0

  const detail = adapter.parseConversationDetail(data)
  if (detail) {
    await applyConversationUpdate(detail.conversation, detail.messages, 'full')
    notifyConversationSynced(detail.conversation.id)
    handled = true
    count = detail.messages.length
  }

  const list = adapter.parseConversationList(data)
  if (list.length > 0) {
    await upsertConversationsMerged(list)
    handled = true
    if (!detail) count = list.length
  }

  if (!handled && adapter.parseStreamResponse) {
    const stream = adapter.parseStreamResponse(data, url)
    if (stream) {
      await applyConversationUpdate(stream.conversation, stream.messages, 'partial')
      notifyConversationSynced(stream.conversation.id)
      return { success: true, count: stream.messages.length }
    }
  }

  return { success: handled, count }
}
