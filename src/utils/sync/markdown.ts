/**
 * Markdown + YAML frontmatter serialization/deserialization
 *
 * Pure functions with no DB dependency — fully testable.
 * Produces human-readable .md files that double as machine-importable backups.
 */

import type { Conversation, Message, MessageRole, Platform } from '@/types'
import { conversationSchema, platformSchema } from '@/types'
import { z } from 'zod'

// ============================================================================
// Constants
// ============================================================================

/** Regex to split messages: only matches `## Role` on its own line */
const MESSAGE_SPLIT_RE = /^## (User|Assistant|System)\s*$/m

const ROLE_MAP: Record<string, MessageRole> = {
  User: 'user',
  Assistant: 'assistant',
  System: 'system',
}

// ============================================================================
// YAML helpers (no library — hand-written for the small subset we need)
// ============================================================================

/**
 * Quote a YAML string value when necessary.
 * - null / undefined → `null`
 * - strings containing special chars → double-quoted with escapes
 * - everything else → bare
 */
export function yamlQuote(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)

  const s = String(value)
  if (s === '') return '""'

  // Must quote if: starts/ends with whitespace, contains chars that confuse YAML
  // or looks like a YAML keyword / number
  const needsQuote =
    /^\s|\s$/.test(s) ||
    /[\n:#[\]{}|>!&*?,'"`\\@%]/.test(s) ||
    /^(?:true|false|null|yes|no|on|off)$/i.test(s) ||
    /^[+-]?\d/.test(s)

  if (!needsQuote) return s

  // Double-quote with minimal escaping
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

/**
 * Serialize a flat Record to YAML frontmatter block (between `---` fences).
 * Supports: string, number, boolean, null, string[], and nested arrays.
 */
export function toYamlFrontmatter(data: Record<string, unknown>): string {
  const lines: string[] = ['---']

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}:`)
        for (const item of value) {
          lines.push(`  - ${yamlQuote(item)}`)
        }
      }
    } else {
      lines.push(`${key}: ${yamlQuote(value)}`)
    }
  }

  lines.push('---')
  return lines.join('\n')
}

/**
 * Parse YAML frontmatter string (between `---` fences) into a Record.
 * Handles the subset we produce: scalars, quoted strings, and `- item` arrays.
 */
export function parseYamlFrontmatter(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // Extract content between --- fences
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return result

  const body = match[1]!
  const lines = body.split('\n')

  let currentKey: string | null = null
  let currentArray: unknown[] | null = null

  for (const line of lines) {
    // Array item
    const arrayMatch = line.match(/^ {2}- (.*)$/)
    if (arrayMatch && currentKey) {
      if (!currentArray) currentArray = []
      currentArray.push(parseYamlValue(arrayMatch[1]!))
      continue
    }

    // Flush previous array
    if (currentKey && currentArray) {
      result[currentKey] = currentArray
      currentArray = null
      currentKey = null
    }

    // Key: value
    const kvMatch = line.match(/^([a-z_]\w*): ?(.*)$/i)
    if (kvMatch) {
      const key = kvMatch[1]!
      const rawValue = kvMatch[2]!

      // Empty array shorthand
      if (rawValue === '[]') {
        result[key] = []
        currentKey = null
        continue
      }

      // Start of block array (value is empty)
      if (rawValue === '') {
        currentKey = key
        currentArray = []
        continue
      }

      result[key] = parseYamlValue(rawValue)
      currentKey = null
    }
  }

  // Flush trailing array
  if (currentKey && currentArray) {
    result[currentKey] = currentArray
  }

  return result
}

/** Parse a single YAML scalar value */
function parseYamlValue(raw: string): unknown {
  if (raw === 'null') return null
  if (raw === 'true') return true
  if (raw === 'false') return false

  // Double-quoted string
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }

  // Number (integer or float)
  if (/^[+-]?\d+(?:\.\d+)?$/.test(raw)) {
    return Number(raw)
  }

  return raw
}

// ============================================================================
// Zod schema for frontmatter validation on import
// ============================================================================

export const markdownFrontmatterSchema = z.object({
  id: z.string(),
  platform: platformSchema,
  originalId: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  messageCount: z.number(),
  preview: z.string(),
  summary: z.string().optional(),
  tags: z.array(z.string()),
  isFavorite: z.coerce.boolean(),
  favoriteAt: z.number().nullable(),
  url: z.string().optional(),
  detailStatus: z.enum(['none', 'partial', 'full']),
  detailSyncedAt: z.number().nullable(),
  syncedAt: z.number(),
  exportVersion: z.string(),
  exportedAt: z.number(),
})

// ============================================================================
// Serialize: Conversation + Messages → Markdown string
// ============================================================================

export function conversationToMarkdown(
  conv: Conversation,
  messages: Message[],
  exportedAt?: number
): string {
  const frontmatter = toYamlFrontmatter({
    id: conv.id,
    platform: conv.platform,
    originalId: conv.originalId,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messageCount: messages.length,
    preview: conv.preview,
    ...(conv.summary ? { summary: conv.summary } : {}),
    tags: conv.tags,
    isFavorite: conv.isFavorite,
    favoriteAt: conv.favoriteAt,
    ...(conv.url ? { url: conv.url } : {}),
    detailStatus: conv.detailStatus,
    detailSyncedAt: conv.detailSyncedAt,
    syncedAt: conv.syncedAt,
    exportVersion: '2.0',
    exportedAt: exportedAt ?? Date.now(),
  })

  const parts: string[] = [frontmatter, '']

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System'
    parts.push(`## ${role}`)
    parts.push('')
    parts.push(msg.content)
    parts.push('')
  }

  return parts.join('\n')
}

// ============================================================================
// Deserialize: Markdown string → Conversation + Messages
// ============================================================================

export interface ParsedMarkdownExport {
  conversation: Conversation
  messages: Message[]
}

export function parseMarkdownExport(content: string): ParsedMarkdownExport {
  // 1. Extract frontmatter
  const fmEnd = content.indexOf('\n---', 4) // skip opening ---
  if (fmEnd === -1) {
    throw new Error('Missing YAML frontmatter')
  }

  const frontmatterText = content.slice(0, fmEnd + 4) // include closing ---
  const body = content.slice(fmEnd + 4).replace(/^\n+/, '') // trim leading newlines after ---

  const raw = parseYamlFrontmatter(frontmatterText)
  const fm = markdownFrontmatterSchema.parse(raw)

  // 2. Build conversation
  const conversation: Conversation = {
    id: fm.id,
    platform: fm.platform as Platform,
    originalId: fm.originalId,
    title: fm.title,
    createdAt: fm.createdAt,
    updatedAt: fm.updatedAt,
    messageCount: fm.messageCount,
    preview: fm.preview,
    ...(fm.summary ? { summary: fm.summary } : {}),
    tags: fm.tags,
    isFavorite: fm.isFavorite,
    favoriteAt: fm.favoriteAt,
    ...(fm.url ? { url: fm.url } : {}),
    detailStatus: fm.detailStatus,
    detailSyncedAt: fm.detailSyncedAt,
    syncedAt: fm.syncedAt,
  }

  // Validate through the canonical schema
  conversationSchema.parse(conversation)

  // 3. Parse messages from body
  const messages = parseMessages(body, fm.id, fm.createdAt)

  return { conversation, messages }
}

/**
 * Parse message body using `## Role` as delimiters.
 * Only matches `## Role` on its own line — safe against code blocks.
 */
function parseMessages(body: string, conversationId: string, baseTimestamp: number): Message[] {
  if (!body.trim()) return []

  const messages: Message[] = []
  const parts = body.split(MESSAGE_SPLIT_RE)

  // parts[0] is text before first ## (should be empty or whitespace)
  // then pairs: [role, content, role, content, ...]
  let index = 0
  for (let i = 1; i < parts.length; i += 2) {
    const roleStr = parts[i]!.trim()
    const content = (parts[i + 1] || '').replace(/^\n/, '').replace(/\n+$/, '')
    const role = ROLE_MAP[roleStr]
    if (!role) continue

    const paddedIndex = String(index).padStart(4, '0')
    messages.push({
      id: `${conversationId}_msg_${paddedIndex}`,
      conversationId,
      role,
      content,
      createdAt: baseTimestamp + index * 1000,
    })
    index++
  }

  return messages
}
