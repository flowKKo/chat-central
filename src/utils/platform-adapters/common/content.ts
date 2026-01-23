/**
 * Common content extraction utilities for platform adapters
 */

/**
 * Extract message content from various API response formats
 * Handles multiple content structures used by different AI platforms
 */
export function extractMessageContent(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const record = item as Record<string, unknown>

  // Direct text/content fields
  if (typeof record.text === 'string') return record.text
  if (typeof record.content === 'string') return record.content

  // Nested content object
  const content = record.content
  if (content && typeof content === 'object') {
    const contentRecord = content as Record<string, unknown>

    // Direct text in content
    if (typeof contentRecord.text === 'string') return contentRecord.text

    // Parts array in content
    if (Array.isArray(contentRecord.parts)) {
      return contentRecord.parts
        .filter((part): part is string => typeof part === 'string')
        .join('\n')
    }
  }

  // Content as array (OpenAI/Claude format)
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object') {
          const partRecord = part as Record<string, unknown>
          if (typeof partRecord.text === 'string') return partRecord.text
          if (partRecord.type === 'text' && typeof partRecord.text === 'string') {
            return partRecord.text
          }
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  // Blocks array (Claude format)
  if (Array.isArray(record.blocks)) {
    return (record.blocks as Array<{ type?: string; text?: string }>)
      .map((part) => (part?.type === 'text' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
  }

  return ''
}

/**
 * Extract role from message object
 */
export function extractRole(message: unknown): 'user' | 'assistant' | null {
  if (!message || typeof message !== 'object') return null
  const record = message as Record<string, unknown>

  const sender = record.sender || record.author || record.role
  if (!sender || typeof sender !== 'string') return null

  const lowerSender = sender.toLowerCase()
  if (lowerSender === 'human' || lowerSender === 'user') return 'user'
  if (lowerSender === 'assistant' || lowerSender === 'model' || lowerSender === 'ai') return 'assistant'

  return null
}

/**
 * Truncate text to a maximum length, preserving word boundaries
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  // Try to break at word boundary
  const truncated = text.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace)
  }

  return truncated
}
