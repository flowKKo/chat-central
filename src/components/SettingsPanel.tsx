import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PLATFORM_CONFIG, type Platform } from '@/types'
import { clearAllData, clearPlatformData } from '@/utils/db'

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
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-8">Settings</h2>

      <div className="max-w-2xl space-y-8">
        <section>
          <h3 className="text-lg font-semibold mb-4">Data Management</h3>
          <div className="space-y-3">
            {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
              <div
                key={platform}
                className="flex items-center justify-between p-4 border border-border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
                  />
                  <span className="font-medium">{PLATFORM_CONFIG[platform].name}</span>
                </div>
                <button
                  className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  onClick={() => handleClearPlatform(platform)}
                  disabled={isClearing}
                >
                  Clear Data
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-4">Danger Zone</h3>
          <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Delete All Data</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete all synced conversations from all platforms
                </p>
              </div>
              <button
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors flex items-center gap-2"
                onClick={handleClearAll}
                disabled={isClearing}
              >
                <Trash2 className="w-4 h-4" />
                {isClearing ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
