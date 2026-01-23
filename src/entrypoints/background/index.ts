import { defineBackground } from 'wxt/sandbox'
import { browser } from 'wxt/browser'
import { getAdapterForUrl, type PlatformAdapter } from '@/utils/platform-adapters'
import { dedupeMessagesByContent } from '@/utils/message-dedupe'
import {
  upsertConversation,
  upsertMessages,
  getConversationById,
  getExistingMessageIds,
  getMessagesByIds,
  getConversations,
  getMessagesByConversationId,
  getDBStats,
  updateConversationFavorite,
} from '@/utils/db'
import { PLATFORM_CONFIG, type Conversation, type Message, type Platform } from '@/types'

export default defineBackground({
  type: 'module',

  main() {
    console.log('[ChatCentral] Background service worker started')

    registerContextMenus()
    const menus = browser.contextMenus
    safeAddListener(menus?.onClicked, handleContextMenuClick)
    safeAddListener(menus?.onShown, handleContextMenuShown)

    // Handle messages from content script
    safeAddListener(browser.runtime?.onMessage, (message: any, _sender: any, sendResponse: any) => {
      handleMessage(message)
        .then(sendResponse)
        .catch((e) => {
          console.error('[ChatCentral] Message handler error:', e)
          sendResponse({ error: e.message })
        })
      return true // Keep message channel open to support asynchronous response
    })

    // Handle extension install/update
    safeAddListener(browser.runtime?.onInstalled, (details: { reason: string }) => {
      if (details.reason === 'install') {
        console.log('[ChatCentral] Extension installed')
        // Open welcome page here
      } else if (details.reason === 'update') {
        console.log('[ChatCentral] Extension updated')
      }

      registerContextMenus()
    })

    // Dev reload: Connect to local WebSocket server for auto-reload
    connectDevReloadServer()
  },
})

const FAVORITE_MENU_ID = 'chat-central-favorite-toggle'

function safeAddListener(target: any, handler: (...args: any[]) => void) {
  if (!target?.addListener) return
  target.addListener(handler)
}

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

    case 'TOGGLE_FAVORITE':
      return handleToggleFavorite(message)

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

  const normalizedMessages = await ensureUniqueGeminiMessages(conversation, messages)

  const existingIds =
    mode === 'partial'
      ? await getExistingMessageIds(normalizedMessages.map((message) => message.id))
      : undefined

  await upsertMessages(normalizedMessages)
  await updateConversationFromMessages(conversation.id, normalizedMessages, { mode, existingIds })
}

async function ensureUniqueGeminiMessages(
  conversation: Conversation,
  messages: Message[]
): Promise<Message[]> {
  if (conversation.platform !== 'gemini') return messages

  const ids = messages.map((message) => message.id)
  const existing = await getMessagesByIds(ids)
  return dedupeMessagesByContent(messages, existing)
}

function registerContextMenus() {
  const menus = browser.contextMenus
  if (!menus?.create) return

  const clear = menus.removeAll?.()
  const createMenu = () => {
    menus.create({
      id: FAVORITE_MENU_ID,
      title: '收藏当前对话',
      contexts: ['page'],
      documentUrlPatterns: [
        'https://claude.ai/*',
        'https://chatgpt.com/*',
        'https://chat.openai.com/*',
        'https://gemini.google.com/*',
      ],
    })
  }

  if (clear && typeof (clear as Promise<void>).then === 'function') {
    ;(clear as Promise<void>).then(createMenu).catch(createMenu)
  } else {
    createMenu()
  }
}

async function handleContextMenuClick(info: any, tab?: any) {
  if (info.menuItemId !== FAVORITE_MENU_ID) return
  const result = await toggleFavoriteFromTab(tab)
  if (!result) {
    console.warn('[ChatCentral] Favorite toggle failed: no conversation detected')
  }
}

async function handleContextMenuShown(_info: any, tab?: any) {
  if (!tab?.url) return

  const parsed = parseConversationFromUrl(tab.url)
  if (!parsed) {
    browser.contextMenus.update(FAVORITE_MENU_ID, { title: '收藏当前对话', enabled: false })
    browser.contextMenus.refresh()
    return
  }

  const existing = await getConversationById(parsed.conversationId)
  const title = existing?.isFavorite ? '取消收藏' : '收藏当前对话'
  browser.contextMenus.update(FAVORITE_MENU_ID, { title, enabled: true })
  browser.contextMenus.refresh()
}

async function toggleFavoriteFromTab(tab?: { url?: string }) {
  if (!tab?.url) return null
  const parsed = parseConversationFromUrl(tab.url)
  if (!parsed) return null

  let conversation = await getConversationById(parsed.conversationId)
  if (!conversation) {
    conversation = buildPlaceholderConversation(parsed, Date.now())
    await upsertConversation(conversation)
  }

  const next = !conversation.isFavorite
  return updateConversationFavorite(conversation.id, next)
}

async function handleToggleFavorite(message: {
  conversationId: string
  value?: boolean
}): Promise<{ success: boolean; conversation?: Conversation | null }> {
  const { conversationId, value } = message
  const existing = await getConversationById(conversationId)
  if (!existing) return { success: false, conversation: null }

  const next = typeof value === 'boolean' ? value : !existing.isFavorite
  const updated = await updateConversationFavorite(conversationId, next)
  return { success: !!updated, conversation: updated }
}

type ParsedConversation = {
  platform: Platform
  originalId: string
  conversationId: string
  url: string
}

function parseConversationFromUrl(rawUrl: string): ParsedConversation | null {
  try {
    const url = new URL(rawUrl)
    const { hostname, pathname } = url

    if (hostname === 'claude.ai') {
      const match = pathname.match(/\/chat\/([^/]+)/)
      if (!match?.[1]) return null
      const originalId = match[1]
      return {
        platform: 'claude',
        originalId,
        conversationId: `claude_${originalId}`,
        url: rawUrl,
      }
    }

    if (hostname === 'chatgpt.com' || hostname === 'chat.openai.com') {
      const match = pathname.match(/\/c\/([^/]+)/)
      if (!match?.[1]) return null
      const originalId = match[1]
      return {
        platform: 'chatgpt',
        originalId,
        conversationId: `chatgpt_${originalId}`,
        url: rawUrl,
      }
    }

    if (hostname === 'gemini.google.com') {
      const match = pathname.match(/\/app\/([^/]+)/)
      if (!match?.[1]) return null
      const originalId = match[1]
      return {
        platform: 'gemini',
        originalId,
        conversationId: `gemini_${originalId}`,
        url: rawUrl,
      }
    }
  } catch {
    return null
  }

  return null
}

function buildPlaceholderConversation(parsed: ParsedConversation, now: number): Conversation {
  return {
    id: parsed.conversationId,
    platform: parsed.platform,
    originalId: parsed.originalId,
    title: 'Unknown conversation',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    preview: '',
    tags: [],
    syncedAt: now,
    detailStatus: 'none',
    detailSyncedAt: null,
    isFavorite: false,
    favoriteAt: null,
    url: parsed.url || PLATFORM_CONFIG[parsed.platform].baseUrl,
  }
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

/**
 * Connect to dev reload WebSocket server (development only)
 * This allows automatic extension reload when the dev server sends a reload signal
 */
function connectDevReloadServer() {
  // Only connect in development mode
  if (import.meta.env.MODE !== 'development') {
    return
  }

  const DEV_RELOAD_PORT = 3717
  const RECONNECT_DELAY = 3000
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function connect() {
    try {
      const ws = new WebSocket(`ws://localhost:${DEV_RELOAD_PORT}`)

      ws.onopen = () => {
        console.log('[ChatCentral] Connected to dev reload server')
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'reload') {
            console.log('[ChatCentral] Reload signal received, reloading extension...')
            browser.runtime.reload()
          }
        } catch (e) {
          console.warn('[ChatCentral] Failed to parse dev reload message:', e)
        }
      }

      ws.onclose = () => {
        console.log('[ChatCentral] Disconnected from dev reload server')
        scheduleReconnect()
      }

      ws.onerror = () => {
        // Error will be followed by close event, no need to handle here
      }
    } catch (e) {
      console.warn('[ChatCentral] Failed to connect to dev reload server:', e)
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RECONNECT_DELAY)
  }

  // Initial connection
  connect()
}
