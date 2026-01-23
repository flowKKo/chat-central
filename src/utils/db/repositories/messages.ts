import type { Message } from '@/types'
import { db } from '../schema'

/**
 * Get all messages for a conversation
 */
export async function getMessagesByConversationId(conversationId: string): Promise<Message[]> {
  return db.messages.where('conversationId').equals(conversationId).sortBy('createdAt')
}

/**
 * Insert or update multiple messages
 */
export async function upsertMessages(messages: Message[]): Promise<void> {
  await db.messages.bulkPut(messages)
}

/**
 * Delete all messages for a conversation
 */
export async function deleteMessagesByConversationId(conversationId: string): Promise<void> {
  await db.messages.where('conversationId').equals(conversationId).delete()
}

/**
 * Get existing message IDs from a list
 */
export async function getExistingMessageIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const results = await db.messages.bulkGet(ids)
  const existing = new Set<string>()
  for (const msg of results) {
    if (msg?.id) existing.add(msg.id)
  }
  return existing
}

/**
 * Get messages by IDs as a map
 */
export async function getMessagesByIds(ids: string[]): Promise<Map<string, Message>> {
  if (ids.length === 0) return new Map()
  const results = await db.messages.bulkGet(ids)
  const existing = new Map<string, Message>()
  for (const msg of results) {
    if (msg?.id) existing.set(msg.id, msg)
  }
  return existing
}

/**
 * Get all messages for export
 */
export async function getAllMessagesForExport(
  conversationIds: string[],
  options?: { includeDeleted?: boolean }
): Promise<Message[]> {
  if (conversationIds.length === 0) return []

  let results = await db.messages.where('conversationId').anyOf(conversationIds).toArray()

  if (!options?.includeDeleted) {
    results = results.filter((m) => !m.deleted)
  }

  return results
}
