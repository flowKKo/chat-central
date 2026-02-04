import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar, CheckSquare, RefreshCw, Star } from 'lucide-react'
import type { Platform, SearchFilters } from '@/types'
import { cn } from '@/utils/cn'
import { useClickOutside } from '@/hooks/useClickOutside'
import { DateRangePicker } from '../ui/DateRangePicker'
import { Tooltip } from '../ui/Tooltip'
import { PlatformFilterDropdown } from './PlatformFilterDropdown'

interface FilterToolbarProps {
  selectedPlatform: Platform | 'all'
  counts: Record<Platform | 'total', number>
  onSelectPlatform: (platform: Platform | 'all') => void
  filters: SearchFilters
  onSetDateRange: (range: { start: number | null; end: number | null }) => void
  hasDateFilter: boolean
  showFavoritesOnly: boolean
  onToggleFavorites: (value: boolean) => void
  isBatchMode: boolean
  onToggleBatchMode: () => void
  isLoading: boolean
  onRefresh: () => void
}

export function FilterToolbar({
  selectedPlatform,
  counts,
  onSelectPlatform,
  filters,
  onSetDateRange,
  hasDateFilter,
  showFavoritesOnly,
  onToggleFavorites,
  isBatchMode,
  onToggleBatchMode,
  isLoading,
  onRefresh,
}: FilterToolbarProps) {
  const { t } = useTranslation('conversations')
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false)
  const dateFilterRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on Escape key
  useEffect(() => {
    if (!isDateFilterOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDateFilterOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isDateFilterOpen])

  // Close date filter dropdown when clicking outside
  useClickOutside(
    dateFilterRef,
    isDateFilterOpen,
    useCallback(() => setIsDateFilterOpen(false), [])
  )

  return (
    <div className="flex items-center gap-2">
      {/* Platform Filter Dropdown */}
      <PlatformFilterDropdown
        selectedPlatform={selectedPlatform}
        counts={counts}
        onSelectPlatform={onSelectPlatform}
      />

      {/* Date filter */}
      <div className="relative" ref={dateFilterRef}>
        <Tooltip label={t('dateFilter')}>
          <button
            type="button"
            className={cn(
              'kbd-focus cursor-pointer rounded-xl border border-border p-2.5 transition-all hover:bg-muted/80',
              hasDateFilter && 'border-primary bg-primary/10 text-primary'
            )}
            onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
            aria-label={t('dateFilter')}
            aria-haspopup="dialog"
            aria-expanded={isDateFilterOpen}
          >
            <Calendar className="h-4 w-4" />
          </button>
        </Tooltip>

        {isDateFilterOpen && (
          <div
            role="dialog"
            aria-label={t('dateRangeFilter')}
            className="absolute right-0 top-full z-10 mt-1 w-72 animate-scale-in rounded-xl border border-border bg-card p-4 shadow-lg"
          >
            <DateRangePicker
              startDate={filters.dateRange.start}
              endDate={filters.dateRange.end}
              onChange={onSetDateRange}
            />
          </div>
        )}
      </div>

      {/* Favorites toggle */}
      <Tooltip label={showFavoritesOnly ? t('showAll') : t('showFavorites')}>
        <button
          type="button"
          className={cn(
            'kbd-focus cursor-pointer rounded-xl border border-border p-2.5 transition-all hover:bg-muted/80',
            showFavoritesOnly && 'border-amber-400 bg-amber-500/10 text-amber-400'
          )}
          onClick={() => onToggleFavorites(!showFavoritesOnly)}
          aria-label={showFavoritesOnly ? t('showAllConversations') : t('showFavoritesOnly')}
          aria-pressed={showFavoritesOnly}
        >
          <Star className={cn('h-4 w-4', showFavoritesOnly && 'fill-amber-400')} />
        </button>
      </Tooltip>

      {/* Batch select toggle */}
      <Tooltip label={isBatchMode ? t('exitSelection') : t('batchSelect')}>
        <button
          type="button"
          className={cn(
            'kbd-focus cursor-pointer rounded-xl border border-border p-2.5 transition-all hover:bg-muted/80',
            isBatchMode && 'border-primary bg-primary/10 text-primary'
          )}
          onClick={onToggleBatchMode}
          aria-label={isBatchMode ? t('exitSelectionMode') : t('enterSelectionMode')}
          aria-pressed={isBatchMode}
        >
          <CheckSquare className="h-4 w-4" />
        </button>
      </Tooltip>

      <Tooltip label={t('common:refresh')}>
        <button
          type="button"
          className={cn(
            'kbd-focus cursor-pointer rounded-xl border border-border p-2.5 transition-all hover:bg-muted/80',
            isLoading && 'animate-pulse'
          )}
          onClick={onRefresh}
          aria-label={t('refreshConversations')}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </button>
      </Tooltip>
    </div>
  )
}
