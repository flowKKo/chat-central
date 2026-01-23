import { cn } from '@/utils/cn'

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
    const start = days === 0 ? new Date().setHours(0, 0, 0, 0) : end - days * 24 * 60 * 60 * 1000
    onChange({ start, end })
  }

  const handleClear = () => {
    onChange({ start: null, end: null })
  }

  const formatDate = (ts: number | null) => {
    if (!ts) return ''
    return new Date(ts).toISOString().split('T')[0]
  }

  const parseDate = (dateStr: string): number | null => {
    if (!dateStr) return null
    return new Date(dateStr).getTime()
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Quick presets */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="cursor-pointer rounded-lg px-2 py-1 text-xs transition-colors hover:bg-muted"
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
          value={formatDate(startDate)}
          onChange={(e) => onChange({ start: parseDate(e.target.value), end: endDate })}
          className="flex-1 rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs"
          aria-label="Start date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={formatDate(endDate)}
          onChange={(e) => onChange({ start: startDate, end: parseDate(e.target.value) })}
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
