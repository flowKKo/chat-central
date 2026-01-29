import { Upload, Loader2, FileArchive } from 'lucide-react'
import { useState, useRef } from 'react'
import { cn } from '@/utils/cn'
import { exportData } from '@/utils/sync/export'
import { importData } from '@/utils/sync/import'
import { createLogger } from '@/utils/logger'
import { ExportPanel } from './ExportPanel'
import { ImportPanel } from './ImportPanel'

const log = createLogger('ImportExport')

interface ImportExportProps {
  className?: string
}

export function ImportExportActions({ className }: ImportExportProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-3">
        <ExportPanel />
        <ImportPanel />
      </div>
    </div>
  )
}

/**
 * Compact version for toolbar/header use
 */
export function ImportExportButtons() {
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportData({ type: 'full' })
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      await importData(file)
      // Reload page to reflect changes
      window.location.reload()
    } catch (error) {
      log.error('Import failed:', error)
      alert(error instanceof Error ? error.message : 'Import failed')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="rounded-md p-1.5 transition-colors hover:bg-muted"
        onClick={handleExport}
        disabled={isExporting}
        title="Export data"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileArchive className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        className="rounded-md p-1.5 transition-colors hover:bg-muted"
        onClick={() => fileInputRef.current?.click()}
        title="Import data"
      >
        <Upload className="h-4 w-4" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  )
}
