import { useEffect, useRef } from 'react'

/**
 * Hook that triggers a callback when a sentinel element becomes visible
 * in a scrollable container, enabling infinite scroll behavior.
 *
 * @param onLoadMore - Called when the sentinel is visible and loading is allowed
 * @param options.hasMore - Whether more items are available
 * @param options.isLoading - Whether a load is in progress
 * @param options.rootMargin - Margin around root (default: '100px')
 * @returns { sentinelRef, containerRef } - Attach to sentinel and scroll container
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  options: { hasMore: boolean; isLoading: boolean; rootMargin?: string }
) {
  const { hasMore, isLoading, rootMargin = '100px' } = options
  const sentinelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = containerRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          onLoadMore()
        }
      },
      { root: container, rootMargin }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore, rootMargin])

  return { sentinelRef, containerRef }
}
