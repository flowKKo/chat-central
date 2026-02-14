import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { SpotlightResult } from '../hooks/useSpotlightSearch'
import { SpotlightResultItem } from './SpotlightResultItem'

interface SpotlightResultListProps {
  results: SpotlightResult[]
  query: string
  selectedIndex: number
  onSelect: (index: number) => void
  onMouseSelect: (index: number) => void
  isDefaultView: boolean
}

export function SpotlightResultList({
  results,
  query,
  selectedIndex,
  onSelect,
  onMouseSelect,
  isDefaultView,
}: SpotlightResultListProps) {
  const { t } = useTranslation('spotlight')
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  return (
    <div className="spotlight-results" ref={listRef} role="listbox">
      {isDefaultView && results.length > 0 && (
        <div className="spotlight-section-header">{t('recentConversations')}</div>
      )}
      {results.map((result, index) => (
        <SpotlightResultItem
          key={result.conversation.id}
          result={result}
          query={isDefaultView ? '' : query}
          isSelected={index === selectedIndex}
          onSelect={() => onSelect(index)}
          onMouseEnter={() => onMouseSelect(index)}
        />
      ))}
    </div>
  )
}
