import { useEffect, useRef } from 'react'
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
  resultsVersion: number
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
  resultsVersion,
}: SpotlightResultListProps) {
  const { t } = useTranslation('spotlight')
  const { sentinelRef, containerRef } = useInfiniteScroll(onLoadMore, {
    hasMore,
    isLoading: isLoadingMore,
  })

  // Track previous result count to identify newly appended items
  const prevCountRef = useRef(results.length)
  const newStartIndex = useRef(-1)

  // On fresh results (version change), reset — no items are "new"
  useEffect(() => {
    prevCountRef.current = 0
    newStartIndex.current = -1
  }, [resultsVersion])

  // On results change, mark where new items start
  useEffect(() => {
    if (results.length > prevCountRef.current && prevCountRef.current > 0) {
      newStartIndex.current = prevCountRef.current
    }
    prevCountRef.current = results.length
  }, [results.length])

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
      {results.map((result, index) => {
        const isNew = newStartIndex.current >= 0 && index >= newStartIndex.current
        const staggerDelay = isNew ? (index - newStartIndex.current) * 10 : 0
        return (
          <SpotlightResultItem
            key={result.conversation.id}
            result={result}
            query={isDefaultView ? '' : query}
            isSelected={index === selectedIndex}
            onSelect={() => onSelect(index)}
            onMouseEnter={() => onMouseSelect(index)}
            isNew={isNew}
            animationDelay={staggerDelay}
          />
        )
      })}
      {isLoadingMore && (
        <div className="spotlight-load-more">
          <div className="spotlight-spinner" />
        </div>
      )}
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  )
}
