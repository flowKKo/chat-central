import type { Platform } from '@/types'
import { PLATFORM_CONFIG } from '@/types'
import { cn } from '@/utils/cn'

interface PlatformTabProps {
  label?: string
  platform?: Platform
  count: number
  isActive: boolean
  onClick: () => void
}

export function PlatformTab({ label, platform, count, isActive, onClick }: PlatformTabProps) {
  const config = platform ? PLATFORM_CONFIG[platform] : null
  const displayLabel = label || config?.name || ''

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={cn(
        'kbd-focus flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
        isActive
          ? platform
            ? 'text-foreground'
            : 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      style={
        isActive && platform
          ? { backgroundColor: `${config?.color}25`, color: config?.color }
          : undefined
      }
      onClick={onClick}
    >
      {platform && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: config?.color }}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
      <span className={cn('text-[10px] tabular-nums', isActive ? 'opacity-90' : 'opacity-70')}>
        {count}
      </span>
    </button>
  )
}
