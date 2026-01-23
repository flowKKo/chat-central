import { useState } from 'react'
import { Trash2, AlertTriangle, Database, Shield } from 'lucide-react'
import { PLATFORM_CONFIG, type Platform } from '@/types'
import { clearAllData, clearPlatformData } from '@/utils/db'
import { cn } from '@/utils/cn'

export function SettingsPanel() {
  const [isClearing, setIsClearing] = useState(false)

  const handleClearAll = async () => {
    if (
      !confirm(
        'Are you sure you want to delete all synced conversations? This cannot be undone.'
      )
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

  return (
    <div className="h-full">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your data and preferences
        </p>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Data Management Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-heading font-semibold">Data Management</h3>
          </div>

          <div className="space-y-2">
            {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
              <div
                key={platform}
                className="group flex items-center justify-between p-4 bg-card/50 border border-border rounded-xl hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{ backgroundColor: `${PLATFORM_CONFIG[platform].color}20` }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
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
                    'px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer',
                    'text-red-400 hover:bg-red-500/10 hover:text-red-300',
                    isClearing && 'opacity-50 cursor-not-allowed'
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
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-heading font-semibold text-red-400">Danger Zone</h3>
          </div>

          <div className="p-5 border border-red-500/30 rounded-xl bg-red-500/5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-medium mb-1">Delete All Data</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete all synced conversations from all platforms. This action cannot be undone.
                </p>
              </div>
              <button
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer',
                  'bg-red-500/20 text-red-400 hover:bg-red-500/30',
                  isClearing && 'opacity-50 cursor-not-allowed'
                )}
                onClick={handleClearAll}
                disabled={isClearing}
              >
                <Trash2 className="w-4 h-4" />
                {isClearing ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </section>

        {/* Privacy Info */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-heading font-semibold">Privacy</h3>
          </div>

          <div className="p-5 border border-emerald-500/20 rounded-xl bg-emerald-500/5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              All your conversation data is stored locally in your browser using IndexedDB.
              No data is sent to external servers. Your conversations remain private and secure on your device.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
