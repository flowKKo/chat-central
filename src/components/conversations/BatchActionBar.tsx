import { useTranslation } from 'react-i18next'
import { useCallback, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useClickOutside } from '@/hooks/useClickOutside'

interface BatchActionBarProps {
  selectedCount: number
  isAllSelected: boolean
  onToggleSelectAll: () => void
  onClearSelection: () => void
  onExportZip: () => Promise<void>
  onExportMarkdown: () => Promise<void>
}

export function BatchActionBar({
  selectedCount,
  isAllSelected,
  onToggleSelectAll,
  onClearSelection,
  onExportZip,
  onExportMarkdown,
}: BatchActionBarProps) {
  const { t } = useTranslation('conversations')
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useClickOutside(
    exportMenuRef,
    isExportMenuOpen,
    useCallback(() => setIsExportMenuOpen(false), [])
  )

  const handleExport = async (exportFn: () => Promise<void>) => {
    setIsExporting(true)
    try {
      await exportFn()
    } finally {
      setIsExporting(false)
      setIsExportMenuOpen(false)
    }
  }

  return (
    <div className="mb-3 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
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

        {/* Export dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50',
              isExporting && 'opacity-50'
            )}
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            disabled={selectedCount === 0 || isExporting}
            aria-haspopup="menu"
            aria-expanded={isExportMenuOpen}
          >
            <Download className="h-3.5 w-3.5" />
            {t('common:export')}
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', isExportMenuOpen && 'rotate-180')}
            />
          </button>

          {isExportMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-10 mt-1 w-44 animate-scale-in overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="w-full cursor-pointer px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
                onClick={() => handleExport(onExportZip)}
              >
                {t('exportAsZip')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full cursor-pointer px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
                onClick={() => handleExport(onExportMarkdown)}
              >
                {t('exportAsMarkdown')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
