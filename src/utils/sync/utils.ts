// ============================================================================
// Shared Sync Utilities
// ============================================================================

/**
 * Calculate SHA-256 hash of a string
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Convert array of objects to JSONL format
 */
export function toJsonl<T>(items: T[]): string {
  return items.map((item) => JSON.stringify(item)).join('\n')
}

/**
 * Parse JSONL content into array of typed objects with validation
 */
export function parseJsonl<T>(
  content: string,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: unknown } },
  onError?: (line: number, message: string) => void
): T[] {
  const items: T[] = []
  const lines = content.split('\n').filter((line) => line.trim())

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    try {
      const parsed = JSON.parse(line)
      const validated = schema.safeParse(parsed)

      if (validated.success && validated.data) {
        items.push(validated.data)
      } else {
        onError?.(i + 1, 'Invalid data format')
      }
    } catch {
      onError?.(i + 1, 'Invalid JSON')
    }
  }

  return items
}

/**
 * Download a blob as a file in the browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Format date for filename (YYYYMMDD_HHmmss)
 */
export function formatDateForFilename(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

/**
 * Simple sync logger with context prefix
 */
export const syncLogger = {
  error: (msg: string, error?: unknown) => {
    console.error(`[Sync] ${msg}`, error ?? '')
  },
  warn: (msg: string) => {
    console.warn(`[Sync] ${msg}`)
  },
  info: (msg: string) => {
    console.info(`[Sync] ${msg}`)
  },
  debug: (msg: string) => {
    if (import.meta.env.DEV) {
      console.log(`[Sync] ${msg}`)
    }
  },
}
