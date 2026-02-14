import { useEffect, useRef } from 'react'

/**
 * Hook that triggers a callback when a sentinel element becomes visible
 * in a scrollable container, enabling infinite scroll behavior.
 *
 * @param onLoadMore Called when the sentinel is visible and loading is allowed
 * @param options Configuration for hasMore, isLoading, and rootMargin
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  options: { hasMore: boolean; isLoading: boolean; rootMargin?: string }
) {
  const { hasMore, isLoading, rootMargin = '0px' } = options
  const sentinelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = containerRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading && !cooldownRef.current) {
          cooldownRef.current = setTimeout(() => {
            cooldownRef.current = null
          }, 1000)
          onLoadMore()
        }
      },
      { root: container, rootMargin }
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
      if (cooldownRef.current) {
        clearTimeout(cooldownRef.current)
        cooldownRef.current = null
      }
    }
  }, [hasMore, isLoading, onLoadMore, rootMargin])

  return { sentinelRef, containerRef }
}
