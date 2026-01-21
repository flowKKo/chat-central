export function parseJsonIfString(data: unknown): unknown {
  if (typeof data !== 'string') return data

  let text = data.trim()
  if (!text) return null

  if (text.startsWith(")]}'") || text.startsWith("))}'") || text.startsWith(")))}'")) {
    const newlineIndex = text.indexOf('\n')
    if (newlineIndex !== -1) {
      text = text.slice(newlineIndex + 1).trimStart()
    }
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

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
