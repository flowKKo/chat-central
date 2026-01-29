import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useState, useRef } from 'react'
import { cn } from '@/utils/cn'
import { importData, validateImportFile } from '@/utils/sync/import'

export interface UIImportResult {
  success: boolean
  conversationsImported: number
  messagesImported: number
  conversationsSkipped: number
  messagesSkipped: number
  errors: string[]
}

interface ImportPanelProps {
  className?: string
}

export function ImportPanel({ className }: ImportPanelProps) {
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<UIImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    <div className={cn(className)}>
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

      {/* Import Result */}
      {importResult && (
        <div
          className={cn(
            'mt-4 rounded-md p-3 text-sm',
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
              {importResult.errors.map((error: string) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
