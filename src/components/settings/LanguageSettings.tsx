import { useAtom, useSetAtom } from 'jotai'
import { Check, ChevronDown, Languages } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '@/types'
import { useClickOutside } from '@/hooks/useClickOutside'
import i18n from '@/locales'
import { configAtom, writeConfigAtom } from '@/utils/atoms/config'
import { cn } from '@/utils/cn'

const languageOptions: { value: SupportedLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
]

export function LanguageSettings() {
  const { t } = useTranslation('settings')
  const [config] = useAtom(configAtom)
  const writeConfig = useSetAtom(writeConfigAtom)
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(
    ref,
    isOpen,
    useCallback(() => setIsOpen(false), [])
  )

  const currentLanguage = config.ui.language ?? 'en'
  const currentLabel = languageOptions.find((o) => o.value === currentLanguage)?.label ?? 'English'

  const handleSelect = (lang: SupportedLanguage) => {
    writeConfig({ ui: { language: lang } })
    i18n.changeLanguage(lang)
    setIsOpen(false)
  }

  return (
    <section className="rounded-2xl border border-border bg-card/50 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Languages className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-semibold">{t('language')}</h2>
            <p className="text-xs text-muted-foreground">{t('languageDesc')}</p>
          </div>
        </div>
        <div className="relative" ref={ref}>
          <button
            type="button"
            className={cn(
              'flex w-40 cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted/50',
              isOpen && 'border-primary/50 ring-1 ring-primary/30'
            )}
            onClick={() => setIsOpen(!isOpen)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={t('languageSelection')}
          >
            {currentLabel}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </button>
          {isOpen && (
            <div
              role="listbox"
              aria-label={t('languageSelection')}
              className="absolute right-0 top-full z-10 mt-1.5 w-40 animate-scale-in overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            >
              {languageOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={currentLanguage === option.value}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/80',
                    currentLanguage === option.value && 'text-primary'
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                  {currentLanguage === option.value && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
