import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_VERSION } from '@/utils/constants'
import {
  AppearanceSettings,
  DangerZoneSettings,
  DataTransferSettings,
  LanguageSettings,
  PlatformDataSettings,
  PrivacyNotice,
  WidgetSettings,
} from './settings'

export function SettingsPanel() {
  const { t } = useTranslation('settings')

  return (
    <div className="mx-auto h-full max-w-3xl">
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        <AppearanceSettings />
        <LanguageSettings />
        <WidgetSettings />
        <DataTransferSettings />
        <PlatformDataSettings />
        <PrivacyNotice />
        <DangerZoneSettings />

        {/* Version Info */}
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>{`Chat Central v${APP_VERSION}`}</span>
        </div>
      </div>
    </div>
  )
}
