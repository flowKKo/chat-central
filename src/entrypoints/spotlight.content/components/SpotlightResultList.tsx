import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import type { SpotlightResult } from '../hooks/useSpotlightSearch'
import { SpotlightResultItem } from './SpotlightResultItem'

interface SpotlightResultListProps {
  results: SpotlightResult[]
  query: string
  selectedIndex: number
  onSelect: (index: number) => void
  onMouseSelect: (index: number) => void
  isDefaultView: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}

export function SpotlightResultList({
  results,
  query,
  selectedIndex,
  onSelect,
  onMouseSelect,
  isDefaultView,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: SpotlightResultListProps) {
  const { t } = useTranslation('spotlight')
  const { sentinelRef, containerRef } = useInfiniteScroll(onLoadMore, {
    hasMore,
    isLoading: isLoadingMore,
  })

  // Scroll selected item into view
  useEffect(() => {
    if (!containerRef.current) return
    const selected = containerRef.current.querySelector('[data-selected="true"]')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, containerRef])

  return (
    <div className="spotlight-results" ref={containerRef} role="listbox">
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
      {isLoadingMore && (
        <div className="spotlight-load-more">
          <div className="spotlight-spinner" />
        </div>
      )}
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  )
}
