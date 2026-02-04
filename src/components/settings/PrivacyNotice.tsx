import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function PrivacyNotice() {
  const { t } = useTranslation('settings')

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
          <Shield className="h-4 w-4 text-emerald-500" />
        </div>
        <div>
          <h2 className="font-heading text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {t('privacy')}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('privacyDesc')}</p>
        </div>
      </div>
    </section>
  )
}
