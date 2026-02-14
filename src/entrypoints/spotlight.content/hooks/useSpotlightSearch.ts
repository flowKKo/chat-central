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
  isLoadingMore: boolean
  isDefaultView: boolean
  hasMore: boolean
  loadMore: () => void
  /** Increments on every fresh load (not on load-more appends) */
  resultsVersion: number
}

const DEBOUNCE_MS = 200
const PAGE_SIZE = 30
const MIN_LOADING_MS = 500

export function useSpotlightSearch(isVisible: boolean): UseSpotlightSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotlightResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isDefaultView, setIsDefaultView] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [resultsVersion, setResultsVersion] = useState(0)
  const searchVersionRef = useRef(0)
  const offsetRef = useRef(0)

  // Load recent conversations when spotlight opens
  useEffect(() => {
    if (!isVisible) return

    setQuery('')
    setIsDefaultView(true)
    setIsLoading(true)
    setHasMore(false)
    setResultsVersion((v) => v + 1)
    offsetRef.current = 0

    const version = ++searchVersionRef.current

    browser.runtime
      .sendMessage({ action: 'GET_RECENT_CONVERSATIONS', limit: PAGE_SIZE })
      .then((response: unknown) => {
        if (searchVersionRef.current !== version) return
        const res = response as {
          conversations?: Conversation[]
          hasMore?: boolean
          error?: string
        }
        if (res.conversations) {
          setResults(
            res.conversations.map((c) => ({
              conversation: c,
              matches: [{ type: 'title' as const, text: c.title }],
            }))
          )
          offsetRef.current = res.conversations.length
          setHasMore(res.hasMore ?? false)
        }
      })
      .catch(() => {})
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
      setHasMore(false)
      setResultsVersion((v) => v + 1)
      offsetRef.current = 0
      const version = ++searchVersionRef.current

      browser.runtime
        .sendMessage({ action: 'GET_RECENT_CONVERSATIONS', limit: PAGE_SIZE })
        .then((response: unknown) => {
          if (searchVersionRef.current !== version) return
          const res = response as {
            conversations?: Conversation[]
            hasMore?: boolean
            error?: string
          }
          if (res.conversations) {
            setResults(
              res.conversations.map((c) => ({
                conversation: c,
                matches: [{ type: 'title' as const, text: c.title }],
              }))
            )
            offsetRef.current = res.conversations.length
            setHasMore(res.hasMore ?? false)
          }
        })
        .catch(() => {})
      return
    }

    setIsDefaultView(false)
    setIsLoading(true)
    setHasMore(false)
    setResultsVersion((v) => v + 1)
    offsetRef.current = 0
    const version = ++searchVersionRef.current

    const timer = setTimeout(() => {
      browser.runtime
        .sendMessage({ action: 'SEARCH_WITH_MATCHES', query: query.trim(), limit: PAGE_SIZE })
        .then((response: unknown) => {
          if (searchVersionRef.current !== version) return
          const res = response as {
            results?: SearchResultWithMatches[]
            hasMore?: boolean
            error?: string
          }
          if (res.results) {
            setResults(res.results)
            offsetRef.current = res.results.length
            setHasMore(res.hasMore ?? false)
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

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    const version = searchVersionRef.current
    const currentOffset = offsetRef.current
    const startTime = Date.now()

    const message = isDefaultView
      ? { action: 'GET_RECENT_CONVERSATIONS', limit: PAGE_SIZE, offset: currentOffset }
      : {
          action: 'SEARCH_WITH_MATCHES',
          query: query.trim(),
          limit: PAGE_SIZE,
          offset: currentOffset,
        }

    browser.runtime
      .sendMessage(message)
      .then((response: unknown) => {
        if (searchVersionRef.current !== version) return

        if (isDefaultView) {
          const res = response as { conversations?: Conversation[]; hasMore?: boolean }
          if (res.conversations) {
            const newResults = res.conversations.map((c) => ({
              conversation: c,
              matches: [
                { type: 'title' as const, text: c.title },
              ] as SearchResultWithMatches['matches'],
            }))
            setResults((prev) => [...prev, ...newResults])
            offsetRef.current = currentOffset + res.conversations.length
            setHasMore(res.hasMore ?? false)
          }
        } else {
          const res = response as { results?: SearchResultWithMatches[]; hasMore?: boolean }
          if (res.results) {
            setResults((prev) => [...prev, ...res.results!])
            offsetRef.current = currentOffset + res.results.length
            setHasMore(res.hasMore ?? false)
          }
        }
      })
      .catch(() => {})
      .finally(async () => {
        const elapsed = Date.now() - startTime
        if (elapsed < MIN_LOADING_MS) {
          await new Promise((r) => {
            setTimeout(r, MIN_LOADING_MS - elapsed)
          })
        }
        setIsLoadingMore(false)
      })
  }, [isLoadingMore, hasMore, isDefaultView, query])

  const handleSetQuery = useCallback((q: string) => {
    setQuery(q)
  }, [])

  return {
    query,
    setQuery: handleSetQuery,
    results,
    isLoading,
    isLoadingMore,
    isDefaultView,
    hasMore,
    loadMore,
    resultsVersion,
  }
}
