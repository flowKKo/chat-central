import { browser } from 'wxt/browser'
import type { Platform } from '@/types'
import { createLogger } from '@/utils/logger'
import { getConversationById, getConversations } from '@/utils/db'
import { exportData } from '@/utils/sync/export'
import { notifyExtensionPages } from '../handlers/utils'

const log = createLogger('DetailFetch')

const CLAUDE_ORG_ID_KEY = 'claude_org_id'
const FETCH_INTERVAL_MS = 800
const POLL_INTERVAL_MS = 500
const POLL_TIMEOUT_MS = 15_000

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

/**
 * Read the stored Claude org_id from browser.storage.local
 */
export async function getClaudeOrgId(): Promise<string | null> {
  const result = await browser.storage.local.get(CLAUDE_ORG_ID_KEY)
  return (result[CLAUDE_ORG_ID_KEY] as string) ?? null
}

/**
 * Find an open Claude tab, preferring the active one
 */
export async function findClaudeTab(): Promise<number | null> {
  const tabs = await browser.tabs.query({ url: 'https://claude.ai/*' })
  if (tabs.length === 0) return null

  // Prefer active tab
  const active = tabs.find((t) => t.active)
  return active?.id ?? tabs[0]?.id ?? null
}

/**
 * Build the Claude conversation detail API URL
 */
export function buildDetailApiUrl(orgId: string, originalId: string): string {
  return `https://claude.ai/api/organizations/${orgId}/chat_conversations/${originalId}`
}

/**
 * Wait for a conversation's detailStatus to become 'full' in the DB
 */
async function waitForDetailSync(conversationId: string): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const conv = await getConversationById(conversationId)
    if (conv?.detailStatus === 'full') return true
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
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
      // Strip the "data:...;base64," prefix
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Orchestrate batch fetching of conversation details and export.
 *
 * 1. Query DB for all conversations on the given platform needing details
 * 2. For each: FETCH_CONVERSATION_DETAIL → Observer → Interceptor → fetch()
 *    (existing auto-capture pipeline processes the response)
 * 3. Report progress via BATCH_FETCH_PROGRESS notifications
 * 4. Generate ZIP export and send base64 in done notification
 */
export async function batchFetchDetails(platform: Platform, limit?: number): Promise<void> {
  const batchToken = `${platform}_${Date.now()}_${Math.random().toString(36).slice(2)}`
  activeBatchToken = batchToken

  const isCancelled = () => activeBatchToken !== batchToken

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

  // Verify prerequisites
  const orgId = await getClaudeOrgId()
  if (!orgId) {
    sendProgress({
      status: 'error',
      completed: 0,
      total: toFetch.length,
      error: 'Claude org_id not found. Please visit claude.ai first to capture it.',
    })
    return
  }

  const tabId = await findClaudeTab()
  if (tabId === null) {
    sendProgress({
      status: 'error',
      completed: 0,
      total: toFetch.length,
      error: 'No Claude tab open. Please open claude.ai in a tab.',
    })
    return
  }

  let completed = 0
  const total = toFetch.length

  sendProgress({ status: 'fetching', completed, total })

  for (const { id, originalId } of toFetch) {
    if (isCancelled()) {
      sendProgress({ status: 'cancelled', completed, total })
      return
    }

    const url = buildDetailApiUrl(orgId, originalId)
    log.info(`Fetching detail for ${id}: ${url}`)

    try {
      await browser.tabs.sendMessage(tabId, {
        action: 'FETCH_CONVERSATION_DETAIL',
        url,
      })
    } catch (e) {
      log.warn(`Failed to send fetch request to Claude tab for ${id}:`, e)
      // Try to find another tab
      const newTabId = await findClaudeTab()
      if (newTabId === null || newTabId === tabId) {
        sendProgress({
          status: 'error',
          completed,
          total,
          error: 'Claude tab was closed or became unavailable.',
        })
        return
      }
      // Retry with the new tab
      try {
        await browser.tabs.sendMessage(newTabId, {
          action: 'FETCH_CONVERSATION_DETAIL',
          url,
        })
      } catch {
        log.warn(`Retry also failed for ${id}, skipping`)
        completed++
        sendProgress({ status: 'fetching', completed, total })
        continue
      }
    }

    // Poll DB until detail arrives or timeout
    const synced = await waitForDetailSync(id)
    if (!synced) {
      log.warn(`Timeout waiting for detail sync of ${id}`)
    }

    completed++
    sendProgress({ status: 'fetching', completed, total })

    // Rate limit: wait before next fetch
    if (completed < total && !isCancelled()) {
      await new Promise((resolve) => setTimeout(resolve, FETCH_INTERVAL_MS))
    }
  }

  // Generate export after all fetches complete
  await generateAndSendExport(platform, completed, total, conversationIds)
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
