import type { Platform } from '@/types'
import { PLATFORM_CONFIG } from '@/types'

interface SpotlightPlatformFilterProps {
  platform: Platform | null
  onCycle: () => void
}

export function SpotlightPlatformFilter({ platform, onCycle }: SpotlightPlatformFilterProps) {
  if (!platform) return null

  const config = PLATFORM_CONFIG[platform]

  return (
    <button type="button" className="spotlight-platform-filter" onClick={onCycle}>
      <span
        className="spotlight-platform-filter-dot"
        style={{ '--platform-color': config.color } as React.CSSProperties}
      />
      <span>{config.name}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.6 }}
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  )
}
