import { getAdapterForUrl, type PlatformAdapter } from '@/utils/platform-adapters'
import { CaptureApiResponseSchema, type CaptureApiResponseMessage } from '../schemas'
import { upsertConversationMerged, applyConversationUpdate } from '../services'

/**
 * Handle captured API response from content script
 */
export async function handleCapturedResponse(
  rawMessage: unknown
): Promise<{ success: boolean; count?: number; error?: string }> {
  const parseResult = CaptureApiResponseSchema.safeParse(rawMessage)
  if (!parseResult.success) {
    console.warn('[ChatCentral] Invalid capture message:', parseResult.error.message)
    return { success: false, error: 'Invalid message format' }
  }

  const message: CaptureApiResponseMessage = parseResult.data
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
  let handled = false
  let count = 0

  const detail = adapter.parseConversationDetail(data)
  if (detail) {
    await applyConversationUpdate(detail.conversation, detail.messages, 'full')
    handled = true
    count = detail.messages.length
  }

  const list = adapter.parseConversationList(data)
  if (list.length > 0) {
    for (const conversation of list) {
      await upsertConversationMerged(conversation)
    }
    handled = true
    if (!detail) count = list.length
  }

  if (!handled && adapter.parseStreamResponse) {
    const stream = adapter.parseStreamResponse(data, url)
    if (stream) {
      await applyConversationUpdate(stream.conversation, stream.messages, 'partial')
      return { success: true, count: stream.messages.length }
    }
  }

  return { success: handled, count }
}
