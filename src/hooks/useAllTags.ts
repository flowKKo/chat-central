import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'

/**
 * Hook to fetch and manage all tags
 */
export function useAllTags() {
  const [allTags, setAllTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTags = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        action: 'GET_ALL_TAGS',
      })) as { tags?: string[] }
      setAllTags(response.tags ?? [])
    } catch (e) {
      console.error('[ChatCentral] Failed to fetch tags:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  return { allTags, isLoading, refetch: fetchTags }
}
