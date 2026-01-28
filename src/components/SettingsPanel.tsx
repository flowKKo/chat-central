import { Info } from 'lucide-react'
import { CloudSyncPanel } from './CloudSyncPanel'
import {
  AppearanceSettings,
  DangerZoneSettings,
  DataTransferSettings,
  PlatformDataSettings,
  PrivacyNotice,
} from './settings'

export function SettingsPanel() {
  return (
    <div className="mx-auto h-full max-w-3xl">
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your preferences and data</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        <AppearanceSettings />
        <DataTransferSettings />
        <CloudSyncPanel />
        <PlatformDataSettings />
        <PrivacyNotice />
        <DangerZoneSettings />

        {/* Version Info */}
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Chat Central v0.1.0</span>
        </div>
      </div>
    </div>
  )
}
