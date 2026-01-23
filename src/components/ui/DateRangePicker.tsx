import { cn } from '@/utils/cn'
import { daysAgo, formatDateString, MS_PER_DAY, parseDateString, startOfDay } from '@/utils/date'

interface DateRangePickerProps {
  startDate: number | null
  endDate: number | null
  onChange: (range: { start: number | null; end: number | null }) => void
  className?: string
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const

export function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
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

  return (
    <div className={cn('space-y-2', className)}>
      {/* Quick presets */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={cn(
              'cursor-pointer rounded-lg px-2 py-1 text-xs transition-colors hover:bg-muted',
              activePreset === preset.days && 'bg-primary/10 font-medium text-primary'
            )}
            onClick={() => handlePreset(preset.days)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom range inputs */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate ? formatDateString(startDate) : ''}
          onChange={(e) => onChange({ start: parseDateString(e.target.value), end: endDate })}
          className="flex-1 rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs"
          aria-label="Start date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={endDate ? formatDateString(endDate) : ''}
          onChange={(e) => onChange({ start: startDate, end: parseDateString(e.target.value) })}
          className="flex-1 rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs"
          aria-label="End date"
        />
      </div>

      {/* Clear button */}
      {(startDate || endDate) && (
        <button
          type="button"
          className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          onClick={handleClear}
        >
          Clear date filter
        </button>
      )}
    </div>
  )
}
