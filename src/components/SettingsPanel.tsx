import { useAtom } from 'jotai'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HardDrive,
  Info,
  Loader2,
  Monitor,
  Moon,
  Shield,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { type Platform, PLATFORM_CONFIG } from '@/types'
import { type ThemePreference, themePreferenceAtom } from '@/utils/atoms/theme'
import { cn } from '@/utils/cn'
import { clearAllData, clearPlatformData } from '@/utils/db'
import { downloadExport, exportData } from '@/utils/sync/export'
import { importData, importFromJson, validateImportFile } from '@/utils/sync/import'
import type { ImportResult } from '@/utils/sync/types'
import { isFileSizeSafe } from '@/utils/sync/utils'
import { CloudSyncPanel } from './CloudSyncPanel'

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function SettingsPanel() {
  const [isClearing, setIsClearing] = useState(false)
  const [themePreference, setThemePreference] = useAtom(themePreferenceAtom)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileSizeWarning, setFileSizeWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClearAll = async () => {
    if (
      !confirm('Are you sure you want to delete all synced conversations? This cannot be undone.')
    ) {
      return
    }
    setIsClearing(true)
    try {
      await clearAllData()
      window.location.reload()
    } finally {
      setIsClearing(false)
    }
  }

  const handleClearPlatform = async (platform: Platform) => {
    if (!confirm(`Delete all ${PLATFORM_CONFIG[platform].name} conversations?`)) {
      return
    }
    setIsClearing(true)
    try {
      await clearPlatformData(platform)
      window.location.reload()
    } finally {
      setIsClearing(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportData({ type: 'full' })
      downloadExport(result)
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
    // (user could select different file while import is running)
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
    <div className="mx-auto h-full max-w-3xl">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your preferences and data</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Appearance */}
        <section className="rounded-2xl border border-border bg-card/50 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Sun className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">Appearance</h2>
              <p className="text-sm text-muted-foreground">Customize how the app looks</p>
            </div>
          </div>

          <div className="flex gap-3" role="radiogroup" aria-label="Theme selection">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isSelected = themePreference === option.value
              return (
                <button
                  type="button"
                  key={option.value}
                  role="radio"
                  aria-checked={isSelected}
                  className={cn(
                    'flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent bg-muted/50 hover:bg-muted'
                  )}
                  onClick={() => setThemePreference(option.value)}
                >
                  <Icon
                    className={cn('h-6 w-6', isSelected ? 'text-primary' : 'text-muted-foreground')}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Data Transfer */}
        <section className="rounded-2xl border border-border bg-card/50 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <HardDrive className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">Data Transfer</h2>
              <p className="text-sm text-muted-foreground">Export or import your conversations</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Export Row */}
            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Export Data</p>
                  <p className="text-sm text-muted-foreground">Download as ZIP archive</p>
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
                    Exporting...
                  </>
                ) : (
                  'Export'
                )}
              </button>
            </div>

            {/* Import Row */}
            <div className="rounded-xl bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Import Data</p>
                    <p className="text-sm text-muted-foreground">Restore from .zip or .json</p>
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
                      'Choose file'
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
                        Importing...
                      </>
                    ) : (
                      'Import'
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
                          Import successful
                        </p>
                        <p className="text-muted-foreground">
                          {importResult.imported.conversations} conversations,{' '}
                          {importResult.imported.messages} messages imported
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-red-600 dark:text-red-400">Import failed</p>
                        {importResult.errors.map((error, i) => (
                          <p key={i} className="text-muted-foreground">
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
        </section>

        {/* Cloud Sync */}
        <CloudSyncPanel />

        {/* Platform Data */}
        <section className="rounded-2xl border border-border bg-card/50 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <svg
                className="h-5 w-5 text-violet-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">Platform Data</h2>
              <p className="text-sm text-muted-foreground">Manage synced data by platform</p>
            </div>
          </div>

          <div className="space-y-2">
            {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
              <div
                key={platform}
                className="flex items-center justify-between rounded-xl bg-muted/30 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${PLATFORM_CONFIG[platform].color}15` }}
                  >
                    <div
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
                    />
                  </div>
                  <span className="font-medium">{PLATFORM_CONFIG[platform].name}</span>
                </div>
                <button
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10',
                    isClearing && 'cursor-not-allowed opacity-50'
                  )}
                  onClick={() => handleClearPlatform(platform)}
                  disabled={isClearing}
                >
                  Clear
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy Notice */}
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <Shield className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="mb-1 font-heading text-base font-semibold text-emerald-600 dark:text-emerald-400">
                Your Data is Private
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                All conversation data is stored locally in your browser using IndexedDB. Nothing is
                sent to external servers. Your data stays on your device.
              </p>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="mb-1 font-heading text-base font-semibold text-red-600 dark:text-red-400">
                  Delete All Data
                </h2>
                <p className="text-sm text-muted-foreground">
                  Permanently delete all conversations from all platforms. This cannot be undone.
                </p>
              </div>
            </div>
            <button
              type="button"
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600',
                isClearing && 'cursor-not-allowed opacity-50'
              )}
              onClick={handleClearAll}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete All'
              )}
            </button>
          </div>
        </section>

        {/* Version Info */}
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Chat Central v0.1.0</span>
        </div>
      </div>
    </div>
  )
}
