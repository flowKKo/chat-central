import { useCallback, useMemo } from 'react'
import { PLATFORM_CONFIG } from '@/types'
import type { SpotlightResult } from '../hooks/useSpotlightSearch'

interface SpotlightResultItemProps {
  result: SpotlightResult
  query: string
  isSelected: boolean
  onSelect: () => void
  onMouseEnter: () => void
  isNew?: boolean
  animationDelay?: number
}

export function SpotlightResultItem({
  result,
  query,
  isSelected,
  onSelect,
  onMouseEnter,
  isNew,
  animationDelay = 0,
}: SpotlightResultItemProps) {
  const { conversation, matches } = result
  const platform = PLATFORM_CONFIG[conversation.platform]

  // Get the best snippet to show
  const snippet = useMemo(() => {
    // Prefer non-title matches for snippet
    const nonTitleMatch = matches.find((m) => m.type !== 'title')
    if (nonTitleMatch) return nonTitleMatch.text
    // Fall back to preview
    if (conversation.preview) return conversation.preview
    return null
  }, [matches, conversation.preview])

  const relativeDate = useMemo(() => {
    return formatRelativeDate(conversation.updatedAt)
  }, [conversation.updatedAt])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onSelect()
    },
    [onSelect]
  )

  return (
    <div
      className="spotlight-item"
      data-selected={isSelected}
      data-new={isNew || undefined}
      style={isNew && animationDelay > 0 ? { animationDelay: `${animationDelay}ms` } : undefined}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={isSelected}
    >
      <div className="spotlight-item-bar" style={{ backgroundColor: platform.color }} />
      <div className="spotlight-item-content">
        <div className="spotlight-item-title">
          <HighlightInline text={conversation.title} query={query} />
        </div>
        {snippet && (
          <div className="spotlight-item-snippet">
            <HighlightInline text={truncate(snippet, 120)} query={query} />
          </div>
        )}
        <div className="spotlight-item-meta">
          <span>{platform.name}</span>
          <span>&middot;</span>
          <span>{relativeDate}</span>
          {conversation.messageCount > 0 && (
            <>
              <span>&middot;</span>
              <span>{conversation.messageCount} msgs</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Simple inline text highlighting for Shadow DOM.
 * Uses <mark> with spotlight-highlight class instead of Tailwind.
 */
function HighlightInline({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts: { text: string; highlight: boolean; key: number }[] = []
  let lastIndex = 0
  let matchIndex = lowerText.indexOf(lowerQuery)
  let key = 0

  while (matchIndex !== -1) {
    if (matchIndex > lastIndex) {
      parts.push({ text: text.slice(lastIndex, matchIndex), highlight: false, key: key++ })
    }
    parts.push({
      text: text.slice(matchIndex, matchIndex + query.length),
      highlight: true,
      key: key++,
    })
    lastIndex = matchIndex + query.length
    matchIndex = lowerText.indexOf(lowerQuery, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false, key: key++ })
  }

  return (
    <>
      {parts.map((p) =>
        p.highlight ? (
          <mark key={p.key} className="spotlight-highlight">
            {p.text}
          </mark>
        ) : (
          <span key={p.key}>{p.text}</span>
        )
      )}
    </>
  )
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`

  return new Date(timestamp).toLocaleDateString()
}
