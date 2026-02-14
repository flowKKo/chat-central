import { useCallback, useRef } from 'react'
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
  const { query, setQuery, results, isLoading, isDefaultView } = useSpotlightSearch(isVisible)
  const selectedIndexRef = useRef(0)

  const handleSelect = useCallback(
    (index: number) => {
      const result = results[index]
      if (!result) return

      // Open the conversation's original platform URL
      const url = result.conversation.url
      if (url) {
        window.open(url, '_blank')
      } else {
        // Fallback: open in dashboard
        const dashUrl = browser.runtime.getURL(
          `/manage.html#/conversations?detail=${result.conversation.id}`
        )
        window.open(dashUrl, '_blank')
      }
      onClose()
    },
    [results, onClose]
  )

  const handleModSelect = useCallback(
    (index: number) => {
      const result = results[index]
      if (!result) return

      // Always open in dashboard
      const dashUrl = browser.runtime.getURL(
        `/manage.html#/conversations?detail=${result.conversation.id}`
      )
      window.open(dashUrl, '_blank')
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

  // Keep ref in sync for callbacks
  selectedIndexRef.current = selectedIndex

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
        />
      ) : (
        !isLoading && <SpotlightEmpty hasQuery={!!query.trim()} />
      )}

      <SpotlightFooter />
    </SpotlightOverlay>
  )
}
