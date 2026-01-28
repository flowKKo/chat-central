import { Clock } from 'lucide-react'
import { useState } from 'react'
import { type Platform, PLATFORM_CONFIG } from '@/types'
import { cn } from '@/utils/cn'
import { clearPlatformData } from '@/utils/db'
import { SettingsSection } from '../ui/SettingsSection'

export function PlatformDataSettings() {
  const [isClearing, setIsClearing] = useState(false)

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
    <SettingsSection
      icon={Clock}
      iconColor="text-violet-500"
      iconBgColor="bg-violet-500/10"
      title="Platform Data"
      description="Manage synced data by platform"
    >
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
          <div
            key={platform}
            className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
              />
              <span className="text-sm font-medium">{PLATFORM_CONFIG[platform].name}</span>
            </div>
            <button
              type="button"
              className={cn(
                'cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10',
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
    </SettingsSection>
  )
}
