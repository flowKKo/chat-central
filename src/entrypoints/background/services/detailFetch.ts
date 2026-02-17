import { browser } from 'wxt/browser'
import type { Platform } from '@/types'
import { createLogger } from '@/utils/logger'
import { getConversationById, getConversations } from '@/utils/db'
import { exportData } from '@/utils/sync/export'
import { notifyExtensionPages } from '../handlers/utils'

const log = createLogger('DetailFetch')

const CLAUDE_ORG_ID_KEY = 'claude_org_id'
const DEFAULT_FETCH_INTERVAL_MS = 800
const DEFAULT_POLL_INTERVAL_MS = 500
const DEFAULT_POLL_TIMEOUT_MS = 15_000

/** Per-batch token to prevent race conditions between concurrent batch fetches */
let activeBatchToken: string | null = null

export interface BatchFetchProgress {
  status: 'fetching' | 'done' | 'error' | 'cancelled'
  completed: number
  total: number
  error?: string
  base64?: string
  filename?: string
}

// ── Platform Fetch Strategies ──

export interface PlatformFetchStrategy {
  tabPatterns: string[]
  noTabError: string
  buildDetailUrl: (originalId: string) => Promise<string> | string
  mode: 'fetch' | 'navigate'
  /** Pre-fetch validation (e.g. Claude org_id check). Returns error string or null. */
  validate?: () => Promise<string | null>
  pollTimeoutMs?: number
  fetchIntervalMs?: number
}

/**
 * Read the stored Claude org_id from browser.storage.local
 */
export async function getClaudeOrgId(): Promise<string | null> {
  const result = await browser.storage.local.get(CLAUDE_ORG_ID_KEY)
  return (result[CLAUDE_ORG_ID_KEY] as string) ?? null
}

const strategies: Record<Platform, PlatformFetchStrategy> = {
  claude: {
    tabPatterns: ['https://claude.ai/*'],
    noTabError: 'No Claude tab open. Please open claude.ai in a tab.',
    mode: 'fetch',
    async validate() {
      const orgId = await getClaudeOrgId()
      if (!orgId) return 'Claude org_id not found. Please visit claude.ai first to capture it.'
      return null
    },
    async buildDetailUrl(originalId: string) {
      const orgId = await getClaudeOrgId()
      return `https://claude.ai/api/organizations/${orgId}/chat_conversations/${originalId}`
    },
  },
  chatgpt: {
    tabPatterns: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
    noTabError: 'No ChatGPT tab open. Please open chatgpt.com in a tab.',
    mode: 'fetch',
    buildDetailUrl(originalId: string) {
      return `https://chatgpt.com/backend-api/conversation/${originalId}`
    },
  },
  gemini: {
    tabPatterns: ['https://gemini.google.com/*'],
    noTabError: 'No Gemini tab found. A background tab will be created.',
    mode: 'navigate',
    pollTimeoutMs: 20_000,
    fetchIntervalMs: 3_000,
    buildDetailUrl(originalId: string) {
      return `https://gemini.google.com/app/${originalId}`
    },
  },
}

export function getStrategy(platform: Platform): PlatformFetchStrategy {
  return strategies[platform]
}

// ── Tab Helpers ──

/**
 * Find an open tab matching the given URL patterns, preferring the active one
 */
export async function findPlatformTab(patterns: string[]): Promise<number | null> {
  const allTabs = await Promise.all(patterns.map((p) => browser.tabs.query({ url: p })))
  const tabs = allTabs.flat()
  if (tabs.length === 0) return null

  const active = tabs.find((t) => t.active)
  return active?.id ?? tabs[0]?.id ?? null
}

// ── Legacy Exports (kept for backward compatibility) ──

export async function findClaudeTab(): Promise<number | null> {
  return findPlatformTab(strategies.claude.tabPatterns)
}

export function buildDetailApiUrl(orgId: string, originalId: string): string {
  return `https://claude.ai/api/organizations/${orgId}/chat_conversations/${originalId}`
}

// ── Core Logic ──

/**
 * Wait for a conversation's detailStatus to become 'full' in the DB
 */
async function waitForDetailSync(conversationId: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const conv = await getConversationById(conversationId)
    if (conv?.detailStatus === 'full') return true
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS))
  }
  return false
}

function sendProgress(progress: BatchFetchProgress): void {
  notifyExtensionPages('BATCH_FETCH_PROGRESS', progress as unknown as Record<string, unknown>)
}

/**
 * Convert a Blob to a base64 string using FileReader (jsdom-compatible)
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Execute a single detail fetch using the strategy's mode
 */
async function executeFetch(
  strategy: PlatformFetchStrategy,
  tabId: number,
  url: string
): Promise<void> {
  if (strategy.mode === 'navigate') {
    await browser.tabs.update(tabId, { url })
  } else {
    await browser.tabs.sendMessage(tabId, {
      action: 'FETCH_CONVERSATION_DETAIL',
      url,
    })
  }
}

/**
 * Orchestrate batch fetching of conversation details and export.
 *
 * 1. Query DB for all conversations on the given platform needing details
 * 2. For each: use platform strategy to fetch detail (fetch or navigate mode)
 *    (existing auto-capture pipeline processes the response)
 * 3. Report progress via BATCH_FETCH_PROGRESS notifications
 * 4. Generate ZIP export and send base64 in done notification
 */
export async function batchFetchDetails(platform: Platform, limit?: number): Promise<void> {
  const batchToken = `${platform}_${Date.now()}_${Math.random().toString(36).slice(2)}`
  activeBatchToken = batchToken

  const isCancelled = () => activeBatchToken !== batchToken
  const strategy = getStrategy(platform)
  const pollTimeout = strategy.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS
  const fetchInterval = strategy.fetchIntervalMs ?? DEFAULT_FETCH_INTERVAL_MS

  // Query conversations for the platform (with optional limit, ordered by most recent)
  const allConversations = await getConversations({
    platform,
    ...(limit ? { limit, orderBy: 'updatedAt' } : {}),
  })

  // Collect IDs for selective export when limit is specified
  const conversationIds = limit ? allConversations.map((c) => c.id) : undefined

  // Filter to those needing details
  const toFetch = allConversations
    .filter((c) => c.detailStatus !== 'full')
    .map((c) => ({ id: c.id, originalId: c.originalId }))

  // If nothing to fetch, still generate the export
  if (toFetch.length === 0) {
    log.info(`All ${platform} conversations already have full details, generating export`)
    await generateAndSendExport(platform, 0, 0, conversationIds)
    return
  }

  // Platform-specific validation (e.g. Claude org_id)
  if (strategy.validate) {
    const validationError = await strategy.validate()
    if (validationError) {
      sendProgress({ status: 'error', completed: 0, total: toFetch.length, error: validationError })
      return
    }
  }

  // Find a platform tab
  let tabId = await findPlatformTab(strategy.tabPatterns)
  let createdTabId: number | null = null

  if (tabId === null) {
    // For navigate mode, create a background tab
    if (strategy.mode === 'navigate') {
      const tab = await browser.tabs.create({
        url: strategy.tabPatterns[0]!.replace('/*', '/'),
        active: false,
      })
      if (tab.id) {
        tabId = tab.id
        createdTabId = tab.id
        // Wait for tab to load
        await new Promise((resolve) => setTimeout(resolve, 3_000))
      }
    }

    if (tabId === null) {
      sendProgress({
        status: 'error',
        completed: 0,
        total: toFetch.length,
        error: strategy.noTabError,
      })
      return
    }
  }

  let completed = 0
  const total = toFetch.length

  sendProgress({ status: 'fetching', completed, total })

  for (const { id, originalId } of toFetch) {
    if (isCancelled()) {
      sendProgress({ status: 'cancelled', completed, total })
      await cleanupCreatedTab(createdTabId)
      return
    }

    const url = await strategy.buildDetailUrl(originalId)
    log.info(`Fetching detail for ${id}: ${url}`)

    try {
      await executeFetch(strategy, tabId, url)
    } catch (e) {
      log.warn(`Failed to send fetch request to ${platform} tab for ${id}:`, e)
      // Try to find another tab
      const newTabId = await findPlatformTab(strategy.tabPatterns)
      if (newTabId === null || newTabId === tabId) {
        sendProgress({
          status: 'error',
          completed,
          total,
          error: `${platform} tab was closed or became unavailable.`,
        })
        await cleanupCreatedTab(createdTabId)
        return
      }
      tabId = newTabId
      // Retry with the new tab
      try {
        await executeFetch(strategy, newTabId, url)
      } catch {
        log.warn(`Retry also failed for ${id}, skipping`)
        completed++
        sendProgress({ status: 'fetching', completed, total })
        continue
      }
    }

    // Poll DB until detail arrives or timeout
    const synced = await waitForDetailSync(id, pollTimeout)
    if (!synced) {
      log.warn(`Timeout waiting for detail sync of ${id}`)
    }

    completed++
    sendProgress({ status: 'fetching', completed, total })

    // Rate limit: wait before next fetch
    if (completed < total && !isCancelled()) {
      await new Promise((resolve) => setTimeout(resolve, fetchInterval))
    }
  }

  await cleanupCreatedTab(createdTabId)

  // Generate export after all fetches complete
  await generateAndSendExport(platform, completed, total, conversationIds)
}

/**
 * Close a tab that was created for batch fetching (Gemini navigate mode)
 */
async function cleanupCreatedTab(tabId: number | null): Promise<void> {
  if (tabId === null) return
  try {
    await browser.tabs.remove(tabId)
  } catch {
    // Tab may already be closed
  }
}

/**
 * Generate a ZIP export for the platform and broadcast the result as base64.
 * When conversationIds is provided, exports only those conversations (selective).
 * Otherwise, exports all conversations for the platform (full).
 */
async function generateAndSendExport(
  platform: Platform,
  completed: number,
  total: number,
  conversationIds?: string[]
): Promise<void> {
  try {
    const result = conversationIds
      ? await exportData({ type: 'selected', conversationIds })
      : await exportData({ type: 'full', platforms: [platform] })
    const base64 = await blobToBase64(result.blob)
    sendProgress({ status: 'done', completed, total, base64, filename: result.filename })
  } catch (e) {
    log.error('Export generation failed:', e)
    sendProgress({ status: 'error', completed, total, error: 'Export generation failed' })
  }
}

/**
 * Cancel an in-progress batch fetch
 */
export function cancelBatchFetch(): void {
  activeBatchToken = null
}
