import { AlertTriangle, CheckCircle2, Download, HardDrive, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'
import { exportData } from '@/utils/sync/export'
import { downloadBlob, isFileSizeSafe } from '@/utils/sync/utils'
import { importData, importFromJson, validateImportFile } from '@/utils/sync/import'
import type { ImportResult } from '@/utils/sync/types'
import { SettingsSection } from '../ui/SettingsSection'

export function DataTransferSettings() {
  const { t } = useTranslation('settings')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileSizeWarning, setFileSizeWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportData({ type: 'full' })
      downloadBlob(result.blob, result.filename)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImportResult(null)

      // Check file size and warn if too large
      const { safe, sizeFormatted } = isFileSizeSafe(file)
      if (!safe) {
        setFileSizeWarning(
          `Large file (${sizeFormatted}). Import may take a while and could affect browser performance.`
        )
      } else {
        setFileSizeWarning(null)
      }
    }
  }

  const handleImport = async () => {
    // Capture file reference to prevent race condition
    const fileToImport = selectedFile
    if (!fileToImport) return

    setIsImporting(true)
    setImportResult(null)
    try {
      const validation = await validateImportFile(fileToImport)
      if (!validation.valid) {
        setImportResult({
          success: false,
          imported: { conversations: 0, messages: 0 },
          skipped: { conversations: 0, messages: 0 },
          conflicts: [],
          errors: validation.errors,
        })
        return
      }

      const result = fileToImport.name.endsWith('.json')
        ? await importFromJson(fileToImport, { conflictStrategy: 'merge' })
        : await importData(fileToImport, { conflictStrategy: 'merge' })

      setImportResult(result)
      if (result.success) {
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <SettingsSection
      icon={HardDrive}
      iconColor="text-blue-500"
      iconBgColor="bg-blue-500/10"
      title={t('dataTransfer')}
      description={t('dataTransferDesc')}
    >
      <div className="space-y-3">
        {/* Export Row */}
        <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <Download className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t('exportData')}</p>
              <p className="text-xs text-muted-foreground">{t('exportDataDesc')}</p>
            </div>
          </div>
          <button
            type="button"
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
              isExporting && 'cursor-not-allowed opacity-50'
            )}
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('exporting')}
              </>
            ) : (
              t('common:export')
            )}
          </button>
        </div>

        {/* Import Row */}
        <div className="rounded-xl bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('importData')}</p>
                <p className="text-xs text-muted-foreground">{t('importDataDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.json"
                onChange={handleFileSelect}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className={cn(
                  'cursor-pointer rounded-lg border border-dashed border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50',
                  selectedFile && 'border-primary bg-primary/5 text-primary'
                )}
              >
                {selectedFile ? (
                  <span className="max-w-32 truncate">{selectedFile.name}</span>
                ) : (
                  t('chooseFile')
                )}
              </label>
              <button
                type="button"
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                  (!selectedFile || isImporting) && 'cursor-not-allowed opacity-50'
                )}
                onClick={handleImport}
                disabled={!selectedFile || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('importing')}
                  </>
                ) : (
                  t('common:import')
                )}
              </button>
            </div>
          </div>

          {/* File Size Warning */}
          {fileSizeWarning && !importResult && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <p className="text-sm text-amber-600 dark:text-amber-400">{fileSizeWarning}</p>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div
              className={cn(
                'mt-3 flex items-start gap-2 rounded-lg p-3',
                importResult.success ? 'bg-emerald-500/10' : 'bg-red-500/10'
              )}
            >
              {importResult.success ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              )}
              <div className="text-sm">
                {importResult.success ? (
                  <>
                    <p className="font-medium text-emerald-600 dark:text-emerald-400">
                      {t('importSuccess')}
                    </p>
                    <p className="text-muted-foreground">
                      {t('importResult', {
                        conversations: importResult.imported.conversations,
                        messages: importResult.imported.messages,
                      })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-red-600 dark:text-red-400">
                      {t('importFailed')}
                    </p>
                    {importResult.errors.map((error) => (
                      <p key={error.message} className="text-muted-foreground">
                        {error.message}
                      </p>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  )
}
