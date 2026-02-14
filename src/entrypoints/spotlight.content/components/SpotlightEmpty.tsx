import { useTranslation } from 'react-i18next'

interface SpotlightEmptyProps {
  hasQuery: boolean
}

export function SpotlightEmpty({ hasQuery }: SpotlightEmptyProps) {
  const { t } = useTranslation('spotlight')

  return (
    <div className="spotlight-empty">
      <div className="spotlight-empty-title">
        {hasQuery ? t('noResults') : t('noConversations')}
      </div>
      <div className="spotlight-empty-hint">
        {hasQuery ? t('noResultsHint') : t('noConversationsHint')}
      </div>
    </div>
  )
}
