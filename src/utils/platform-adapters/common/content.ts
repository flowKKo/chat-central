/**
 * Common content extraction utilities for platform adapters
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for content extraction strategies
 */
export interface ContentExtractionConfig {
  /** Direct string fields to check (e.g., ['text', 'content']) */
  stringFields?: string[]
  /** Fields to check for nested objects with text property */
  objectTextFields?: string[]
  /** Array fields containing content parts */
  arrayFields?: string[]
  /** Function to extract text from array parts */
  partTextExtractor?: (part: unknown) => string
  /** Path to delta text in streaming responses (e.g., ['delta', 'text']) */
  deltaPath?: string[]
  /** Field name for completion text in streaming responses */
  completionField?: string
  /** Whether to validate extracted content with trim() */
  validateTrim?: boolean
}

// ============================================================================
// Platform-Specific Configurations
// ============================================================================

/**
 * Claude message content extraction config
 */
export const CLAUDE_MESSAGE_CONFIG: ContentExtractionConfig = {
  stringFields: ['text', 'content'],
  objectTextFields: ['text'],
  arrayFields: ['content', 'blocks'],
  validateTrim: true,
  partTextExtractor: (part: unknown) => {
    if (typeof part === 'string') return part
    if (part && typeof part === 'object') {
      const p = part as Record<string, unknown>
      if (typeof p.text === 'string') return p.text
      if (p.type === 'text' && typeof p.text === 'string') return p.text
    }
    return ''
  },
}

/**
 * Claude stream content extraction config
 */
export const CLAUDE_STREAM_CONFIG: ContentExtractionConfig = {
  completionField: 'completion',
  deltaPath: ['delta', 'text'],
  stringFields: ['text', 'content'],
  arrayFields: ['content'],
  partTextExtractor: (part: unknown) => {
    if (typeof part === 'string') return part
    if (part && typeof part === 'object') {
      const p = part as Record<string, unknown>
      if (p.type === 'text') return p.text as string
    }
    return ''
  },
}

/**
 * ChatGPT content extraction config
 */
export const CHATGPT_CONTENT_CONFIG: ContentExtractionConfig = {
  stringFields: ['content'],
  objectTextFields: ['text'],
  arrayFields: ['parts'],
  partTextExtractor: (part: unknown) => (typeof part === 'string' ? part : ''),
}

// ============================================================================
// Configurable Extraction Function
// ============================================================================

/**
 * Extract content using a configurable strategy
 */
export function extractContentWithConfig(item: unknown, config: ContentExtractionConfig): string {
  if (!item || typeof item !== 'object') return ''
  const record = item as Record<string, unknown>

  // Check completion field (for streaming)
  if (config.completionField && typeof record[config.completionField] === 'string') {
    return record[config.completionField] as string
  }

  // Check delta path (for streaming)
  if (config.deltaPath) {
    let current: unknown = record
    for (const key of config.deltaPath) {
      if (!current || typeof current !== 'object') break
      current = (current as Record<string, unknown>)[key]
    }
    if (typeof current === 'string') return current
  }

  // Check message wrapper
  const message = (record.message ?? record) as Record<string, unknown>

  // Check direct string fields
  if (config.stringFields) {
    for (const field of config.stringFields) {
      const value = message[field]
      if (typeof value === 'string') {
        if (!config.validateTrim || value.trim()) {
          return value
        }
      }
    }
  }

  // Check nested object text fields
  if (config.objectTextFields) {
    const content = message.content
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const contentObj = content as Record<string, unknown>
      for (const field of config.objectTextFields) {
        const value = contentObj[field]
        if (typeof value === 'string') {
          if (!config.validateTrim || value.trim()) {
            return value
          }
        }
      }
    }
  }

  // Check array fields
  if (config.arrayFields && config.partTextExtractor) {
    for (const field of config.arrayFields) {
      // Check both direct field and content.field
      const sources = [
        message[field],
        (message.content as Record<string, unknown> | undefined)?.[field],
      ]

      for (const arr of sources) {
        if (Array.isArray(arr)) {
          const result = arr.map(config.partTextExtractor).filter(Boolean).join('\n')
          if (!config.validateTrim || result.trim()) {
            return result
          }
        }
      }
    }
  }

  return ''
}

// ============================================================================
// Platform-Specific Extraction Functions
// ============================================================================

/**
 * Extract content from Claude message detail
 */
export function extractClaudeMessageContent(message: unknown): string {
  return extractContentWithConfig(message, CLAUDE_MESSAGE_CONFIG)
}

/**
 * Extract content from Claude stream response
 */
export function extractClaudeStreamContent(payload: unknown): string {
  return extractContentWithConfig(payload, CLAUDE_STREAM_CONFIG)
}

/**
 * Extract content from ChatGPT message
 */
export function extractChatGPTContent(msg: unknown): string {
  if (!msg || typeof msg !== 'object') return ''
  const obj = msg as Record<string, unknown>
  const content = obj.content as Record<string, unknown> | string | undefined

  // Handle direct string content
  if (typeof content === 'string') return content

  // Handle content object with parts or text
  if (content && typeof content === 'object') {
    if (Array.isArray(content.parts)) {
      return content.parts.filter((p: unknown) => typeof p === 'string').join('\n')
    }
    if (typeof content.text === 'string') {
      return content.text
    }
  }

  return ''
}

// ============================================================================
// Generic Extraction Function (Backward Compatible)
// ============================================================================

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
  if (lowerSender === 'assistant' || lowerSender === 'model' || lowerSender === 'ai')
    return 'assistant'

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
