import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { cn } from '@/utils/cn'

interface BatchActionBarProps {
  selectedCount: number
  isAllSelected: boolean
  onToggleSelectAll: () => void
  onClearSelection: () => void
  onExport: () => Promise<void>
}

export function BatchActionBar({
  selectedCount,
  isAllSelected,
  onToggleSelectAll,
  onClearSelection,
  onExport,
}: BatchActionBarProps) {
  const { t } = useTranslation('conversations')
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await onExport()
    } finally {
      setIsExporting(false)
    }
  }

  const isDisabled = selectedCount === 0 || isExporting

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
        <span className="text-sm font-medium">{t('selected', { count: selectedCount })}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
            onClick={onToggleSelectAll}
          >
            {isAllSelected ? t('deselectAll') : t('selectAll')}
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
            onClick={onClearSelection}
          >
            {t('clearSelection')}
          </button>

          {/* Export button */}
          <button
            type="button"
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50',
              isExporting && 'opacity-50'
            )}
            onClick={handleExport}
            disabled={isDisabled}
          >
            <Download className="h-3.5 w-3.5" />
            {t('common:export')}
          </button>
        </div>
      </div>
    </div>
  )
}
