import { useMemo } from 'react'
import { cn } from '@/utils/cn'

interface HighlightTextProps {
  text: string
  query: string
  className?: string
  highlightClassName?: string
  maxLength?: number
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
}: HighlightTextProps) {
  const parts = useMemo(() => {
    if (!query.trim()) {
      return [{ text: maxLength ? truncateText(text, maxLength) : text, highlight: false }]
    }

    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const result: { text: string; highlight: boolean }[] = []

    let lastIndex = 0
    let matchIndex = lowerText.indexOf(lowerQuery)

    // If maxLength is set and match exists, center the text around the first match
    let displayText = text
    let offset = 0
    if (maxLength && matchIndex >= 0) {
      const { text: truncated, offset: off } = truncateAroundMatch(
        text,
        matchIndex,
        query.length,
        maxLength
      )
      displayText = truncated
      offset = off
      matchIndex = matchIndex - offset
    } else if (maxLength) {
      displayText = truncateText(text, maxLength)
    }

    const lowerDisplayText = displayText.toLowerCase()
    lastIndex = 0
    matchIndex = lowerDisplayText.indexOf(lowerQuery)

    while (matchIndex !== -1) {
      // Add text before match
      if (matchIndex > lastIndex) {
        result.push({ text: displayText.slice(lastIndex, matchIndex), highlight: false })
      }

      // Add matched text
      result.push({
        text: displayText.slice(matchIndex, matchIndex + query.length),
        highlight: true,
      })

      lastIndex = matchIndex + query.length
      matchIndex = lowerDisplayText.indexOf(lowerQuery, lastIndex)
    }

    // Add remaining text
    if (lastIndex < displayText.length) {
      result.push({ text: displayText.slice(lastIndex), highlight: false })
    }

    return result
  }, [text, query, maxLength])

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlight ? (
          <mark key={index} className={cn('font-medium', highlightClassName)}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
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
  maxLength: number
): { text: string; offset: number } {
  if (text.length <= maxLength) {
    return { text, offset: 0 }
  }

  const padding = Math.floor((maxLength - matchLength) / 2)
  let start = Math.max(0, matchIndex - padding)
  let end = Math.min(text.length, matchIndex + matchLength + padding)

  // Adjust if we hit boundaries
  if (start === 0) {
    end = Math.min(text.length, maxLength)
  } else if (end === text.length) {
    start = Math.max(0, text.length - maxLength)
  }

  let result = text.slice(start, end)
  const offset = start

  // Add ellipsis
  if (start > 0) {
    result = `...${result.slice(3)}`
  }
  if (end < text.length) {
    result = `${result.slice(0, -3)}...`
  }

  return { text: result, offset }
}
