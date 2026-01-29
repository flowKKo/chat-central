import { Download, Loader2, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import type { Platform } from '@/types'
import { cn } from '@/utils/cn'
import { exportData } from '@/utils/sync/export'

interface ExportPanelProps {
  className?: string
}

export function ExportPanel({ className }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      const platforms: Platform[] = ['claude', 'chatgpt', 'gemini']
      const result = await exportData({ type: 'full', platforms })

      // Create download link
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className={cn(className)}>
      {/* Export Button */}
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export Data
      </button>

      {/* Export Error */}
      {exportError && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{exportError}</span>
        </div>
      )}
    </div>
  )
}
