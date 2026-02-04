import { useAtom, useSetAtom } from 'jotai'
import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '@/types'
import i18n from '@/locales'
import { configAtom, writeConfigAtom } from '@/utils/atoms/config'
import { cn } from '@/utils/cn'
import { SettingsSection } from '../ui/SettingsSection'

const languageOptions: { value: SupportedLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
]

export function LanguageSettings() {
  const { t } = useTranslation('settings')
  const [config] = useAtom(configAtom)
  const writeConfig = useSetAtom(writeConfigAtom)

  const currentLanguage = config.ui.language ?? 'en'

  return (
    <SettingsSection
      icon={Languages}
      iconColor="text-primary"
      iconBgColor="bg-primary/10"
      title={t('language')}
      description={t('languageDesc')}
    >
      <div className="flex gap-3" role="radiogroup" aria-label={t('languageSelection')}>
        {languageOptions.map((option) => {
          const isSelected = currentLanguage === option.value
          return (
            <button
              type="button"
              key={option.value}
              role="radio"
              aria-checked={isSelected}
              className={cn(
                'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 py-2.5 transition-all',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent bg-muted/50 hover:bg-muted'
              )}
              onClick={() => {
                writeConfig({ ui: { language: option.value } })
                i18n.changeLanguage(option.value)
              }}
            >
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
    </SettingsSection>
  )
}
