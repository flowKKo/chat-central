import { useAtom } from 'jotai'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Keyboard,
  Lightbulb,
  Loader2,
  Monitor,
  Moon,
  Package,
  Palette,
  Shield,
  Sun,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { type Platform, PLATFORM_CONFIG } from '@/types'
import { type ThemePreference, themePreferenceAtom } from '@/utils/atoms/theme'
import { cn } from '@/utils/cn'
import { clearAllData, clearPlatformData } from '@/utils/db'
import { downloadExport, exportData } from '@/utils/sync/export'
import { importData, importFromJson, validateImportFile } from '@/utils/sync/import'
import type { ImportResult } from '@/utils/sync/types'

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const tips = [
  {
    icon: Keyboard,
    title: 'Quick Search',
    description: 'Press Cmd/Ctrl + K to quickly search conversations',
  },
  {
    icon: Zap,
    title: 'Auto Sync',
    description: 'Conversations sync automatically when you visit AI platforms',
  },
  {
    icon: Lightbulb,
    title: 'Favorites',
    description: 'Star important conversations for quick access later',
  },
]

export function SettingsPanel() {
  const [isClearing, setIsClearing] = useState(false)
  const [themePreference, setThemePreference] = useAtom(themePreferenceAtom)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
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
    }
  }

  const handleImport = async () => {
    if (!selectedFile) return

    setIsImporting(true)
    setImportResult(null)
    try {
      const validation = await validateImportFile(selectedFile)
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

      const result = selectedFile.name.endsWith('.json')
        ? await importFromJson(selectedFile, { conflictStrategy: 'merge' })
        : await importData(selectedFile, { conflictStrategy: 'merge' })

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
    <div className="h-full">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your data and preferences</p>
      </div>

      <div className="flex gap-8">
        {/* Main Settings - Left Column */}
        <div className="min-w-0 max-w-2xl flex-1 space-y-8">
          {/* Appearance Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-lg font-semibold">Appearance</h3>
            </div>

            <div className="rounded-xl border border-border bg-card/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">Theme</span>
                  <p className="text-xs text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>
              </div>

              <div className="flex gap-2" role="radiogroup" aria-label="Theme selection">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const isSelected = themePreference === option.value
                  return (
                    <button
                      key={option.value}
                      role="radio"
                      aria-checked={isSelected}
                      className={cn(
                        'flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/50'
                      )}
                      onClick={() => setThemePreference(option.value)}
                    >
                      <Icon className={cn('h-5 w-5', isSelected && 'text-primary')} />
                      <span className={cn('text-sm font-medium', isSelected && 'text-primary')}>
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Data Transfer Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-lg font-semibold">Data Transfer</h3>
            </div>

            <div className="space-y-4">
              {/* Export */}
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Export</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Download all conversations as a ZIP archive
                    </p>
                  </div>
                  <button
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                      'bg-primary/10 text-primary hover:bg-primary/20',
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
                      <>
                        <Download className="h-4 w-4" />
                        Export All
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Import */}
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Import</span>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  Restore from a previous export (.zip or .json)
                </p>

                <div className="flex items-center gap-3">
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
                      'flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm transition-all hover:border-muted-foreground/50 hover:bg-muted/30',
                      selectedFile && 'border-primary bg-primary/5'
                    )}
                  >
                    {selectedFile ? (
                      <span className="max-w-48 truncate text-primary">{selectedFile.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Choose file...</span>
                    )}
                  </label>
                  <button
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                      'bg-primary/10 text-primary hover:bg-primary/20',
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
                      <>
                        <Upload className="h-4 w-4" />
                        Import
                      </>
                    )}
                  </button>
                </div>

                {/* Import Result */}
                {importResult && (
                  <div
                    className={cn(
                      'mt-4 rounded-lg p-3',
                      importResult.success
                        ? 'border border-emerald-500/20 bg-emerald-500/10'
                        : 'border border-red-500/20 bg-red-500/10'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {importResult.success ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                      )}
                      <div className="flex-1 text-sm">
                        {importResult.success ? (
                          <div>
                            <p className="font-medium text-emerald-400">Import successful</p>
                            <p className="mt-1 text-muted-foreground">
                              Imported {importResult.imported.conversations} conversations,{' '}
                              {importResult.imported.messages} messages
                              {(importResult.skipped.conversations > 0 ||
                                importResult.skipped.messages > 0) && (
                                <>
                                  {' '}
                                  (skipped {importResult.skipped.conversations} conversations,{' '}
                                  {importResult.skipped.messages} messages)
                                </>
                              )}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-red-400">Import failed</p>
                            {importResult.errors.map((error, i) => (
                              <p key={i} className="mt-1 text-muted-foreground">
                                {error.message}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Data Management Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-lg font-semibold">Data Management</h3>
            </div>

            <div className="space-y-2">
              {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
                <div
                  key={platform}
                  className="group flex items-center justify-between rounded-xl border border-border bg-card/50 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${PLATFORM_CONFIG[platform].color}20` }}
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
                      />
                    </div>
                    <div>
                      <span className="font-medium">{PLATFORM_CONFIG[platform].name}</span>
                      <p className="text-xs text-muted-foreground">Clear all synced data</p>
                    </div>
                  </div>
                  <button
                    className={cn(
                      'cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-all',
                      'text-red-400 hover:bg-red-500/10 hover:text-red-300',
                      isClearing && 'cursor-not-allowed opacity-50'
                    )}
                    onClick={() => handleClearPlatform(platform)}
                    disabled={isClearing}
                  >
                    Clear Data
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Danger Zone Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <h3 className="font-heading text-lg font-semibold text-red-400">Danger Zone</h3>
            </div>

            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="mb-1 font-medium">Delete All Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all synced conversations from all platforms. This action
                    cannot be undone.
                  </p>
                </div>
                <button
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                    'bg-red-500/20 text-red-400 hover:bg-red-500/30',
                    isClearing && 'cursor-not-allowed opacity-50'
                  )}
                  onClick={handleClearAll}
                  disabled={isClearing}
                >
                  <Trash2 className="h-4 w-4" />
                  {isClearing ? 'Deleting...' : 'Delete All'}
                </button>
              </div>
            </div>
          </section>

          {/* Privacy Info */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              <h3 className="font-heading text-lg font-semibold">Privacy</h3>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                All your conversation data is stored locally in your browser using IndexedDB. No
                data is sent to external servers. Your conversations remain private and secure on
                your device.
              </p>
            </div>
          </section>
        </div>

        {/* Tips Sidebar - Right Column */}
        <div className="hidden w-72 flex-shrink-0 xl:block">
          <div className="sticky top-6">
            <div className="rounded-2xl border border-border bg-card/50 p-5">
              <h3 className="mb-4 flex items-center gap-2 font-heading font-semibold">
                <Lightbulb className="h-4 w-4 text-amber-400" />
                Tips & Shortcuts
              </h3>
              <div className="space-y-4">
                {tips.map((tip) => (
                  <div key={tip.title} className="flex gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                      <tip.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="mb-0.5 text-sm font-medium">{tip.title}</h4>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {tip.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="mt-4 rounded-2xl border border-border bg-card/50 p-5">
              <h3 className="mb-4 font-heading font-semibold">Keyboard Shortcuts</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Search</span>
                  <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs">Cmd + K</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">New Tab</span>
                  <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs">Cmd + T</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Toggle Favorite</span>
                  <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs">F</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
