import { useMemo } from 'react'
import { cn } from '@/utils/cn'

interface HighlightTextProps {
  text: string
  query: string
  className?: string
  highlightClassName?: string
  maxLength?: number
  /** Use gradient fade instead of ellipsis for truncation */
  fadeEdges?: boolean
}

/**
 * Component that highlights matching text within a string
 */
export function HighlightText({
  text,
  query,
  className,
  highlightClassName = 'bg-amber-500/30 text-foreground rounded-sm px-0.5',
  maxLength,
  fadeEdges = false,
}: HighlightTextProps) {
  const { parts, hasTruncatedStart, hasTruncatedEnd } = useMemo(() => {
    if (!query.trim()) {
      const truncated = maxLength ? truncateText(text, maxLength) : text
      return {
        parts: [{ text: truncated, highlight: false, offset: 0 }],
        hasTruncatedStart: false,
        hasTruncatedEnd: maxLength ? text.length > maxLength : false,
      }
    }

    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const result: { text: string, highlight: boolean, offset: number }[] = []

    let matchIndex = lowerText.indexOf(lowerQuery)

    // If maxLength is set and match exists, center the text around the first match
    let displayText = text
    let truncatedStart = false
    let truncatedEnd = false

    if (maxLength && matchIndex >= 0) {
      const {
        text: truncated,
        hasStart,
        hasEnd,
      } = truncateAroundMatch(text, matchIndex, query.length, maxLength, fadeEdges)
      displayText = truncated
      truncatedStart = hasStart
      truncatedEnd = hasEnd
      // Recalculate match index in the truncated text
      const lowerDisplayText = displayText.toLowerCase()
      matchIndex = lowerDisplayText.indexOf(lowerQuery)
    }
    else if (maxLength) {
      displayText = truncateText(text, maxLength)
      truncatedEnd = text.length > maxLength
    }

    const lowerDisplayText = displayText.toLowerCase()
    let lastIndex = 0
    let currentMatchIndex = lowerDisplayText.indexOf(lowerQuery)

    while (currentMatchIndex !== -1) {
      // Add text before match
      if (currentMatchIndex > lastIndex) {
        result.push({ text: displayText.slice(lastIndex, currentMatchIndex), highlight: false, offset: lastIndex })
      }

      // Add matched text
      result.push({
        text: displayText.slice(currentMatchIndex, currentMatchIndex + query.length),
        highlight: true,
        offset: currentMatchIndex,
      })

      lastIndex = currentMatchIndex + query.length
      currentMatchIndex = lowerDisplayText.indexOf(lowerQuery, lastIndex)
    }

    // Add remaining text
    if (lastIndex < displayText.length) {
      result.push({ text: displayText.slice(lastIndex), highlight: false, offset: lastIndex })
    }

    return {
      parts: result,
      hasTruncatedStart: truncatedStart,
      hasTruncatedEnd: truncatedEnd,
    }
  }, [text, query, maxLength, fadeEdges])

  if (fadeEdges && (hasTruncatedStart || hasTruncatedEnd)) {
    return (
      <span className={cn('relative inline-flex items-center', className)}>
        {hasTruncatedStart && (
          <span
            className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-inherit to-transparent"
            style={{
              background:
                'linear-gradient(to right, var(--fade-color, rgb(var(--muted) / 0.5)), transparent)',
            }}
          />
        )}
        <span className="overflow-hidden">
          {parts.map((part) =>
            part.highlight
              ? (
                  <mark key={part.offset} className={cn('font-medium', highlightClassName)}>
                    {part.text}
                  </mark>
                )
              : (
                  <span key={part.offset}>{part.text}</span>
                ),
          )}
        </span>
        {hasTruncatedEnd && (
          <span
            className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-inherit to-transparent"
            style={{
              background:
                'linear-gradient(to left, var(--fade-color, rgb(var(--muted) / 0.5)), transparent)',
            }}
          />
        )}
      </span>
    )
  }

  return (
    <span className={className}>
      {parts.map((part) =>
        part.highlight
          ? (
              <mark key={part.offset} className={cn('font-medium', highlightClassName)}>
                {part.text}
              </mark>
            )
          : (
              <span key={part.offset}>{part.text}</span>
            ),
      )}
    </span>
  )
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

function truncateAroundMatch(
  text: string,
  matchIndex: number,
  matchLength: number,
  maxLength: number,
  fadeEdges: boolean,
): { text: string, hasStart: boolean, hasEnd: boolean } {
  if (text.length <= maxLength) {
    return { text, hasStart: false, hasEnd: false }
  }

  // Give more padding before the match for better context
  const paddingBefore = Math.floor((maxLength - matchLength) * 0.4)
  const paddingAfter = maxLength - matchLength - paddingBefore

  let start = Math.max(0, matchIndex - paddingBefore)
  let end = Math.min(text.length, matchIndex + matchLength + paddingAfter)

  // Adjust if we hit boundaries
  if (start === 0) {
    end = Math.min(text.length, maxLength)
  }
  else if (end === text.length) {
    start = Math.max(0, text.length - maxLength)
  }

  const hasStart = start > 0
  const hasEnd = end < text.length

  let result = text.slice(start, end)

  // If not using fade edges, add ellipsis
  if (!fadeEdges) {
    if (hasStart) {
      result = `...${result.slice(3)}`
    }
    if (hasEnd) {
      result = `${result.slice(0, -3)}...`
    }
  }

  return { text: result, hasStart, hasEnd }
}
