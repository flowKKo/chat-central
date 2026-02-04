import { useAtom, useSetAtom } from 'jotai'
import { Check, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '@/types'
import i18n from '@/locales'
import { configAtom, writeConfigAtom } from '@/utils/atoms/config'
import { cn } from '@/utils/cn'
import { SettingsSection } from '../ui/SettingsSection'

const languageOptions: { value: SupportedLanguage; label: string; nativeName: string }[] = [
  { value: 'en', label: 'English', nativeName: 'English' },
  { value: 'zh-CN', label: '简体中文', nativeName: 'Simplified Chinese' },
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
      <div
        className="overflow-hidden rounded-xl border border-border"
        role="radiogroup"
        aria-label={t('languageSelection')}
      >
        {languageOptions.map((option, index) => {
          const isSelected = currentLanguage === option.value
          return (
            <button
              type="button"
              key={option.value}
              role="radio"
              aria-checked={isSelected}
              className={cn(
                'flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-muted/50',
                index > 0 && 'border-t border-border',
                isSelected && 'bg-primary/5'
              )}
              onClick={() => {
                writeConfig({ ui: { language: option.value } })
                i18n.changeLanguage(option.value)
              }}
            >
              <div className="flex flex-col">
                <span
                  className={cn(
                    'text-sm font-medium',
                    isSelected ? 'text-foreground' : 'text-foreground'
                  )}
                >
                  {option.label}
                </span>
                <span className="text-xs text-muted-foreground">{option.nativeName}</span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </button>
          )
        })}
      </div>
    </SettingsSection>
  )
}
