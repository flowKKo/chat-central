import { parseJsonCandidates, parseJsonSafe, stripXssiPrefix } from '../common'

/**
 * Normalize raw data into array of payloads
 */
export function normalizePayloads(data: unknown): unknown[] {
  if (Array.isArray(data) || (data && typeof data === 'object')) return [data]
  if (typeof data !== 'string') return []

  const text = stripXssiPrefix(data)
  if (!text) return []
  return parseJsonCandidates(text)
}

/**
 * Extract WRB (Bard) payloads from nested data
 */
export function extractWrbPayloads(payloads: unknown[]): unknown[] {
  const results: unknown[] = []

  const visit = (value: unknown) => {
    if (!value) return

    if (Array.isArray(value)) {
      if (value.length >= 3 && value[0] === 'wrb.fr' && typeof value[2] === 'string') {
        const parsed = parseJsonSafe(value[2] as string)
        if (parsed) results.push(parsed)
        return
      }

      for (const item of value) {
        visit(item)
      }
      return
    }

    if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
      const parsed = parseJsonSafe(value)
      if (parsed) visit(parsed)
    }
  }

  for (const payload of payloads) {
    visit(payload)
  }

  return results
}

/**
 * Get all payload sources from raw data
 */
export function getPayloadSources(data: unknown): unknown[] {
  const payloads = normalizePayloads(data)
  const wrbPayloads = extractWrbPayloads(payloads)
  return wrbPayloads.length > 0 ? wrbPayloads : payloads
}
