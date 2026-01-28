import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/utils/date'

/**
 * Format a timestamp as a relative date string
 */
export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / MS_PER_MINUTE)
  const hours = Math.floor(diff / MS_PER_HOUR)
  const days = Math.floor(diff / MS_PER_DAY)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}
