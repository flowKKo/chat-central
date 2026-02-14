import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { browser } from 'wxt/browser'
import type { Platform } from '@/types'
import type { BatchFetchProgress } from '@/entrypoints/background/services/detailFetch'

interface WidgetPanelProps {
  platform: Platform
  onClose: () => void
}

type ExportState = 'idle' | 'selecting' | 'fetching'

const PRESET_QUANTITIES = [10, 20, 50] as const

function downloadBase64Zip(base64: string, filename: string): void {
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function WidgetPanel({ platform, onClose }: WidgetPanelProps) {
  const { t } = useTranslation('common')
  const panelRef = useRef<HTMLDivElement>(null)
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  // null means "All"
  const [selectedQuantity, setSelectedQuantity] = useState<number | null>(null)
  const [customValue, setCustomValue] = useState('')
  const [platformCount, setPlatformCount] = useState<number | null>(null)

  // Click-outside close (within Shadow DOM)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !e.composedPath().includes(panelRef.current)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [onClose])

  // Escape key close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (exportState === 'selecting') {
          setExportState('idle')
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, exportState])

  // Listen for BATCH_FETCH_PROGRESS from background
  useEffect(() => {
    const listener = (message: unknown) => {
      if (
        typeof message !== 'object' ||
        message === null ||
        (message as Record<string, unknown>).action !== 'BATCH_FETCH_PROGRESS'
      ) {
        return
      }

      const p = message as unknown as BatchFetchProgress & { action: string }

      switch (p.status) {
        case 'fetching':
          setProgress({ completed: p.completed, total: p.total })
          break
        case 'done':
          if (p.base64 && p.filename) {
            downloadBase64Zip(p.base64, p.filename)
          }
          setExportState('idle')
          setProgress({ completed: 0, total: 0 })
          break
        case 'error':
        case 'cancelled':
          setExportState('idle')
          setProgress({ completed: 0, total: 0 })
          break
      }
    }

    browser.runtime.onMessage.addListener(listener)
    return () => {
      browser.runtime.onMessage.removeListener(listener)
    }
  }, [])

  const openDashboard = useCallback(() => {
    browser.runtime.sendMessage({ action: 'GET_SYNC_STATUS' }).catch(() => {})
    browser.runtime.sendMessage({
      action: 'OPEN_EXTENSION_PAGE',
      path: '/manage.html#/conversations',
    })
  }, [])

  const openSettings = useCallback(() => {
    browser.runtime.sendMessage({
      action: 'OPEN_EXTENSION_PAGE',
      path: '/manage.html#/settings',
    })
  }, [])

  const handleExportClick = useCallback(() => {
    setExportState('selecting')
    setSelectedQuantity(null)
    setCustomValue('')
    // Fetch platform stats
    browser.runtime
      .sendMessage({ action: 'GET_STATS' })
      .then((response: unknown) => {
        const resp = response as { byPlatform?: Record<string, number> } | undefined
        const count = resp?.byPlatform?.[platform] ?? 0
        setPlatformCount(count)
      })
      .catch(() => {
        setPlatformCount(0)
      })
  }, [platform])

  const handleStartExport = useCallback(() => {
    // Determine the limit: selectedQuantity null means All (no limit)
    const limit = selectedQuantity ?? undefined

    setExportState('fetching')
    setProgress({ completed: 0, total: 0 })
    browser.runtime
      .sendMessage({
        action: 'BATCH_FETCH_AND_EXPORT',
        platform,
        ...(limit ? { limit } : {}),
      })
      .catch(() => {
        setExportState('idle')
      })
  }, [platform, selectedQuantity])

  const handleCancelExport = useCallback(() => {
    browser.runtime.sendMessage({ action: 'BATCH_FETCH_CANCEL' }).catch(() => {})
    setExportState('idle')
    setProgress({ completed: 0, total: 0 })
  }, [])

  const handleCloseSelecting = useCallback(() => {
    setExportState('idle')
  }, [])

  const handleCustomInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '')
    setCustomValue(val)
    const num = Number.parseInt(val, 10)
    if (num > 0) {
      setSelectedQuantity(num)
    }
  }, [])

  const isExpanded = exportState === 'selecting'

  return (
    <div
      ref={panelRef}
      className={`widget-panel fixed z-[2147483646] flex flex-col rounded-l-2xl border border-r-0 border-border/50 bg-card/80 shadow-xl backdrop-blur-xl ${
        isExpanded ? 'widget-panel-expanded gap-2 p-3' : 'gap-1.5 p-2'
      }`}
      style={{ right: 0, top: '50%', transform: 'translateY(-50%)' }}
    >
      {isExpanded ? (
        /* ── Expanded: Export Selection Panel ── */
        <>
          {/* Top row: Dashboard + Settings + Close */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={openDashboard}
              className="widget-panel-btn flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              title={t('dashboard')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={openSettings}
              className="widget-panel-btn flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              title={t('settings')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleCloseSelecting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title={t('close')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" x2="6" y1="6" y2="18" />
                <line x1="6" x2="18" y1="6" y2="18" />
              </svg>
            </button>
          </div>

          <div className="mx-1 h-px bg-border/60" />

          {/* Title + conversation count */}
          <div className="px-1">
            <div className="text-sm font-medium text-foreground">{t('exportConversations')}</div>
            {platformCount !== null && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t('conversationCount', { count: platformCount })}
              </div>
            )}
          </div>

          {/* Preset buttons 2x2 grid */}
          <div className="grid grid-cols-2 gap-1.5 px-0.5">
            {PRESET_QUANTITIES.map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => {
                  setSelectedQuantity(qty)
                  setCustomValue('')
                }}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  selectedQuantity === qty
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/80 text-secondary-foreground hover:bg-secondary'
                }`}
              >
                {qty}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSelectedQuantity(null)
                setCustomValue('')
              }}
              className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                selectedQuantity === null && customValue === ''
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/80 text-secondary-foreground hover:bg-secondary'
              }`}
            >
              {t('all')}
            </button>
          </div>

          {/* Custom input */}
          <div className="px-0.5">
            <input
              type="text"
              inputMode="numeric"
              placeholder={t('customNumber')}
              value={customValue}
              onChange={handleCustomInput}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
            />
          </div>

          {/* Start Export button */}
          <div className="px-0.5">
            <button
              type="button"
              onClick={handleStartExport}
              className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t('startExport')}
            </button>
          </div>
        </>
      ) : (
        /* ── Collapsed: Normal icon buttons ── */
        <>
          <button
            type="button"
            onClick={openDashboard}
            className="widget-panel-btn flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
            title={t('dashboard')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
            </svg>
          </button>

          <div className="mx-auto h-px w-5 bg-border/60" />

          <button
            type="button"
            onClick={openSettings}
            className="widget-panel-btn flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
            title={t('settings')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>

          <div className="mx-auto h-px w-5 bg-border/60" />

          {/* Export button */}
          {exportState === 'idle' ? (
            <button
              type="button"
              onClick={handleExportClick}
              className="widget-panel-btn flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
              title={t('exportAll')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-0.5 px-0.5">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {progress.completed}/{progress.total}
              </span>
              <button
                type="button"
                onClick={handleCancelExport}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title={t('cancelExport')}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" x2="6" y1="6" y2="18" />
                  <line x1="6" x2="18" y1="6" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
