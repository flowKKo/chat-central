import { Download, Upload, Loader2, CheckCircle, AlertCircle, FileArchive } from 'lucide-react'
import { useState, useRef } from 'react'
import type { Platform } from '@/types'
import { cn } from '@/utils/cn'
import { exportData } from '@/utils/sync/export'
import { importData, validateImportFile } from '@/utils/sync/import'

interface ImportExportProps {
  className?: string
}

interface UIImportResult {
  success: boolean
  conversationsImported: number
  messagesImported: number
  conversationsSkipped: number
  messagesSkipped: number
  errors: string[]
}

export function ImportExportActions({ className }: ImportExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<UIImportResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportResult(null)

    try {
      // First validate
      const validation = await validateImportFile(file)

      if (!validation.valid) {
        setImportResult({
          success: false,
          conversationsImported: 0,
          messagesImported: 0,
          conversationsSkipped: 0,
          messagesSkipped: 0,
          errors: validation.errors.map((e) => e.message),
        })
        return
      }

      // Then import
      const result = await importData(file)
      setImportResult({
        success: result.success,
        conversationsImported: result.imported.conversations,
        messagesImported: result.imported.messages,
        conversationsSkipped: result.skipped.conversations,
        messagesSkipped: result.skipped.messages,
        errors: result.errors.map((e) => e.message),
      })
    } catch (error) {
      setImportResult({
        success: false,
        conversationsImported: 0,
        messagesImported: 0,
        conversationsSkipped: 0,
        messagesSkipped: 0,
        errors: [error instanceof Error ? error.message : 'Import failed'],
      })
    } finally {
      setIsImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-3">
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

        {/* Import Button */}
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
          onClick={handleImportClick}
          disabled={isImporting}
        >
          {isImporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Import Data
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Export Error */}
      {exportError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div
          className={cn(
            'rounded-md p-3 text-sm',
            importResult.success
              ? 'bg-green-100 text-green-800'
              : 'bg-destructive/10 text-destructive'
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            {importResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="font-medium">
              {importResult.success ? 'Import successful' : 'Import failed'}
            </span>
          </div>

          {importResult.success && (
            <ul className="space-y-1 text-xs">
              <li>
                Conversations imported:
                {importResult.conversationsImported}
              </li>
              <li>
                Messages imported:
                {importResult.messagesImported}
              </li>
              {importResult.conversationsSkipped > 0 && (
                <li>
                  Conversations skipped:
                  {importResult.conversationsSkipped}
                </li>
              )}
              {importResult.messagesSkipped > 0 && (
                <li>
                  Messages skipped:
                  {importResult.messagesSkipped}
                </li>
              )}
            </ul>
          )}

          {importResult.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {importResult.errors.map((error: string, i: number) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
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
      console.error('Import failed:', error)
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
