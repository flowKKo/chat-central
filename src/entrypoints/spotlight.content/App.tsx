import { useCallback } from 'react'
import { browser } from 'wxt/browser'
import { useSpotlightSearch } from './hooks/useSpotlightSearch'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { SpotlightOverlay } from './components/SpotlightOverlay'
import { SpotlightInput } from './components/SpotlightInput'
import { SpotlightResultList } from './components/SpotlightResultList'
import { SpotlightEmpty } from './components/SpotlightEmpty'
import { SpotlightFooter } from './components/SpotlightFooter'

interface AppProps {
  isVisible: boolean
  onClose: () => void
}

export function App({ isVisible, onClose }: AppProps) {
  const { query, setQuery, results, isLoading, isLoadingMore, isDefaultView, hasMore, loadMore } =
    useSpotlightSearch(isVisible)

  const handleSelect = useCallback(
    (index: number) => {
      const result = results[index]
      if (!result) return

      // Open the conversation's original platform URL
      const url = result.conversation.url
      if (url) {
        window.open(url, '_blank')
      } else {
        // Fallback: open in dashboard via background (chrome-extension:// URLs
        // are blocked by Chrome when opened from web page context)
        browser.runtime.sendMessage({
          action: 'OPEN_EXTENSION_PAGE',
          path: `/manage.html#/conversations?detail=${result.conversation.id}`,
        })
      }
      onClose()
    },
    [results, onClose]
  )

  const handleModSelect = useCallback(
    (index: number) => {
      const result = results[index]
      if (!result) return

      // Open in dashboard via background
      browser.runtime.sendMessage({
        action: 'OPEN_EXTENSION_PAGE',
        path: `/manage.html#/conversations?detail=${result.conversation.id}`,
      })
      onClose()
    },
    [results, onClose]
  )

  const { selectedIndex, setSelectedIndex } = useKeyboardNavigation({
    itemCount: results.length,
    onSelect: handleSelect,
    onModSelect: handleModSelect,
    onClose,
    isVisible,
  })

  if (!isVisible) return null

  return (
    <SpotlightOverlay onClose={onClose}>
      <SpotlightInput
        query={query}
        onQueryChange={setQuery}
        isLoading={isLoading}
        isVisible={isVisible}
      />

      {results.length > 0 ? (
        <SpotlightResultList
          results={results}
          query={query}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          onMouseSelect={setSelectedIndex}
          isDefaultView={isDefaultView}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
        />
      ) : (
        !isLoading && <SpotlightEmpty hasQuery={!!query.trim()} />
      )}

      <SpotlightFooter />
    </SpotlightOverlay>
  )
}
