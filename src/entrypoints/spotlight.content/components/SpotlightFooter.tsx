import { useTranslation } from 'react-i18next'

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)

export function SpotlightFooter() {
  const { t } = useTranslation('spotlight')
  const modKey = isMac ? '\u2318' : 'Ctrl'

  return (
    <div className="spotlight-footer">
      <div className="spotlight-footer-group">
        <kbd>&uarr;</kbd>
        <kbd>&darr;</kbd>
        <span>{t('navigate')}</span>
      </div>
      <div className="spotlight-footer-group">
        <kbd>&crarr;</kbd>
        <span>{t('open')}</span>
      </div>
      <div className="spotlight-footer-group">
        <kbd>{modKey}</kbd>
        <kbd>&crarr;</kbd>
        <span>Dashboard</span>
      </div>
      <div className="spotlight-footer-group">
        <kbd>Esc</kbd>
        <span>{t('dismiss')}</span>
      </div>
    </div>
  )
}
