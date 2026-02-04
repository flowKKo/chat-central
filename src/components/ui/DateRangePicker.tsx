import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'
import { daysAgo, formatDateString, MS_PER_DAY, parseDateString, startOfDay } from '@/utils/date'

interface DateRangePickerProps {
  startDate: number | null
  endDate: number | null
  onChange: (range: { start: number | null; end: number | null }) => void
  className?: string
}

const PRESETS = [
  { labelKey: 'today', days: 0 },
  { labelKey: '7days', days: 7 },
  { labelKey: '30days', days: 30 },
  { labelKey: '90days', days: 90 },
] as const

export function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
  const { t } = useTranslation('common')

  const handlePreset = (days: number) => {
    const end = Date.now()
    const start = days === 0 ? startOfDay(end) : daysAgo(days)
    onChange({ start, end })
  }

  const handleClear = () => {
    onChange({ start: null, end: null })
  }

  /**
   * Check if current range matches a preset
   */
  const getActivePreset = (): number | null => {
    if (!startDate || !endDate) return null

    const now = Date.now()
    // Allow 1 minute tolerance for "now" comparison
    const isEndNow = Math.abs(endDate - now) < 60 * 1000

    if (!isEndNow) return null

    for (const preset of PRESETS) {
      const expectedStart = preset.days === 0 ? startOfDay(now) : daysAgo(preset.days)
      // Allow 1 day tolerance for preset matching
      if (Math.abs(startDate - expectedStart) < MS_PER_DAY) {
        return preset.days
      }
    }
    return null
  }

  const activePreset = getActivePreset()
  const hasFilter = startDate !== null || endDate !== null

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with title and clear button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{t('dateRange')}</span>
        {hasFilter && (
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
            {t('clear')}
          </button>
        )}
      </div>

      {/* Quick presets - grid layout for consistent sizing */}
      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.labelKey}
            type="button"
            className={cn(
              'cursor-pointer whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
              activePreset === preset.days
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={() => handlePreset(preset.days)}
          >
            {t(preset.labelKey)}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {t('custom')}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Custom range inputs - stacked layout */}
      <div className="space-y-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="date-start" className="text-[10px] font-medium text-muted-foreground">
            {t('from')}
          </label>
          <input
            id="date-start"
            type="date"
            value={startDate ? formatDateString(startDate) : ''}
            onChange={(e) => onChange({ start: parseDateString(e.target.value), end: endDate })}
            className="w-full cursor-pointer rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs transition-colors hover:bg-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="date-end" className="text-[10px] font-medium text-muted-foreground">
            {t('to')}
          </label>
          <input
            id="date-end"
            type="date"
            value={endDate ? formatDateString(endDate) : ''}
            onChange={(e) => onChange({ start: startDate, end: parseDateString(e.target.value) })}
            className="w-full cursor-pointer rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs transition-colors hover:bg-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  )
}
