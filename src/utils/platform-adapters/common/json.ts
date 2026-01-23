/**
 * Common JSON parsing utilities for platform adapters
 */

/**
 * Strip XSSI prefix from response text
 * Common prefixes: )]}'  )]}  )]}'\n
 */
export function stripXssiPrefix(text: string): string {
  const trimmed = text.trim()
  // Match various XSSI prefix patterns
  if (trimmed.startsWith(")]}'") || trimmed.startsWith("))}'") || trimmed.startsWith(")))}'")) {
    const newlineIndex = trimmed.indexOf('\n')
    if (newlineIndex === -1) return ''
    return trimmed.slice(newlineIndex + 1).trimStart()
  }
  return trimmed
}

/**
 * Safely parse JSON, returning null on failure
 */
export function parseJsonSafe(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Parse JSON from string data, handling XSSI prefix
 */
export function parseJsonIfString(data: unknown): unknown {
  if (typeof data !== 'string') return data

  const text = stripXssiPrefix(data)
  if (!text) return null

  return parseJsonSafe(text)
}

/**
 * Parse multiple JSON candidates from text (for multi-line responses)
 */
export function parseJsonCandidates(text: string): unknown[] {
  const results: unknown[] = []

  // Try direct parse first
  const direct = parseJsonSafe(text)
  if (direct) return [direct]

  // Try line-by-line parsing
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const parsed = parseJsonSafe(line)
    if (parsed) results.push(parsed)
  }

  // Try extracting array from text
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start !== -1 && end > start) {
    const parsed = parseJsonSafe(text.slice(start, end + 1))
    if (parsed) results.push(parsed)
  }

  return results
}

/**
 * Parse SSE (Server-Sent Events) data format
 */
export function parseSseData(raw: string): string[] {
  return raw
    .split(/\n\n+/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
        .trim()
    )
    .filter((data) => data.length > 0)
}
