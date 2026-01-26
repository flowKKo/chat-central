import { useCallback, useRef, useState } from 'react'
import { ChevronDown, Filter } from 'lucide-react'
import { cn } from '@/utils/cn'
import { PLATFORM_CONFIG, type Platform } from '@/types'
import { useClickOutside } from '@/hooks/useClickOutside'

interface PlatformFilterDropdownProps {
  selectedPlatform: Platform | 'all'
  counts: Record<Platform | 'total', number>
  onSelectPlatform: (platform: Platform | 'all') => void
}

export function PlatformFilterDropdown({
  selectedPlatform,
  counts,
  onSelectPlatform,
}: PlatformFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(
    ref,
    isOpen,
    useCallback(() => setIsOpen(false), [])
  )

  const handleSelect = (platform: Platform | 'all') => {
    onSelectPlatform(platform)
    setIsOpen(false)
  }

  return (
    <div className="relative flex-1" ref={ref}>
      <button
        type="button"
        className="kbd-focus flex w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm transition-colors hover:bg-muted/80"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filter by platform"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span>
            {selectedPlatform === 'all'
              ? `All Platforms (${counts.total})`
              : `${PLATFORM_CONFIG[selectedPlatform].name} (${counts[selectedPlatform]})`}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 animate-scale-in overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <button
            type="button"
            role="option"
            aria-selected={selectedPlatform === 'all'}
            className={cn(
              'w-full cursor-pointer px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80',
              selectedPlatform === 'all' && 'bg-primary/10 text-primary'
            )}
            onClick={() => handleSelect('all')}
          >
            All Platforms ({counts.total})
          </button>
          {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
            <button
              type="button"
              key={platform}
              role="option"
              aria-selected={selectedPlatform === platform}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80',
                selectedPlatform === platform && 'bg-primary/10 text-primary'
              )}
              onClick={() => handleSelect(platform)}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
              />
              {PLATFORM_CONFIG[platform].name} ({counts[platform]})
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
