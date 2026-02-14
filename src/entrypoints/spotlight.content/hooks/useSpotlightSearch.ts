import { useCallback, useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import type { Conversation } from '@/types'
import type { SearchResultWithMatches } from '@/utils/db/search'

export interface SpotlightResult {
  conversation: Conversation
  matches: SearchResultWithMatches['matches']
}

interface UseSpotlightSearchReturn {
  query: string
  setQuery: (q: string) => void
  results: SpotlightResult[]
  isLoading: boolean
  isDefaultView: boolean
}

const DEBOUNCE_MS = 200
const DEFAULT_LIMIT = 10
const SEARCH_LIMIT = 20

export function useSpotlightSearch(isVisible: boolean): UseSpotlightSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotlightResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDefaultView, setIsDefaultView] = useState(true)
  const searchVersionRef = useRef(0)

  // Load recent conversations when spotlight opens
  useEffect(() => {
    if (!isVisible) return

    setQuery('')
    setIsDefaultView(true)
    setIsLoading(true)

    const version = ++searchVersionRef.current

    browser.runtime
      .sendMessage({ action: 'GET_RECENT_CONVERSATIONS', limit: DEFAULT_LIMIT })
      .then((response: unknown) => {
        if (searchVersionRef.current !== version) return
        const res = response as { conversations?: Conversation[]; error?: string }
        if (res.conversations) {
          setResults(
            res.conversations.map((c) => ({
              conversation: c,
              matches: [{ type: 'title' as const, text: c.title }],
            }))
          )
        }
      })
      .catch(() => {
        // Silently handle — background may not be ready
      })
      .finally(() => {
        if (searchVersionRef.current === version) {
          setIsLoading(false)
        }
      })
  }, [isVisible])

  // Debounced search when query changes
  useEffect(() => {
    if (!isVisible) return

    if (!query.trim()) {
      // Reset to recent conversations
      setIsDefaultView(true)
      const version = ++searchVersionRef.current

      browser.runtime
        .sendMessage({ action: 'GET_RECENT_CONVERSATIONS', limit: DEFAULT_LIMIT })
        .then((response: unknown) => {
          if (searchVersionRef.current !== version) return
          const res = response as { conversations?: Conversation[]; error?: string }
          if (res.conversations) {
            setResults(
              res.conversations.map((c) => ({
                conversation: c,
                matches: [{ type: 'title' as const, text: c.title }],
              }))
            )
          }
        })
        .catch(() => {})
      return
    }

    setIsDefaultView(false)
    setIsLoading(true)
    const version = ++searchVersionRef.current

    const timer = setTimeout(() => {
      browser.runtime
        .sendMessage({ action: 'SEARCH_WITH_MATCHES', query: query.trim(), limit: SEARCH_LIMIT })
        .then((response: unknown) => {
          if (searchVersionRef.current !== version) return
          const res = response as { results?: SearchResultWithMatches[]; error?: string }
          if (res.results) {
            setResults(res.results)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (searchVersionRef.current === version) {
            setIsLoading(false)
          }
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query, isVisible])

  const handleSetQuery = useCallback((q: string) => {
    setQuery(q)
  }, [])

  return { query, setQuery: handleSetQuery, results, isLoading, isDefaultView }
}
