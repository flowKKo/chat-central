import { browser } from 'wxt/browser'
import { getConversationById, upsertConversation, updateConversationFavorite } from '@/utils/db'
import { createLogger } from '@/utils/logger'
import { parseConversationFromUrl, buildPlaceholderConversation } from './services'

const log = createLogger('ChatCentral')

export const FAVORITE_MENU_ID = 'chat-central-favorite-toggle'

/**
 * Register context menus for the extension
 */
export function registerContextMenus() {
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

/**
 * Handle context menu click
 */
// eslint-disable-next-line ts/no-explicit-any
export async function handleContextMenuClick(info: any, tab?: any) {
  if (info.menuItemId !== FAVORITE_MENU_ID) return
  const result = await toggleFavoriteFromTab(tab)
  if (!result) {
    log.warn('Favorite toggle failed: no conversation detected')
  }
}

/**
 * Handle context menu shown - update menu title based on favorite status
 */
// eslint-disable-next-line ts/no-explicit-any
export async function handleContextMenuShown(_info: any, tab?: any) {
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

/**
 * Toggle favorite from tab URL
 */
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
