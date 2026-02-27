import { useEffect, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { browser } from 'wxt/browser'
import { SettingsSection } from '../ui/SettingsSection'

interface ShortcutInfo {
  description: string
  shortcut: string | undefined
}

/** Mac modifier symbols that Chrome returns as a joined string (e.g. "⇧⌘K") */
const MAC_MODIFIERS = new Set(['⇧', '⌘', '⌃', '⌥'])

/**
 * Parse a shortcut string into individual key tokens.
 * Handles both Windows/Linux format ("Ctrl+Shift+K") and
 * macOS format ("⇧⌘K" — symbols joined without delimiters).
 */
function parseShortcutKeys(shortcut: string): string[] {
  if (shortcut.includes('+')) return shortcut.split('+')

  // macOS: split modifier symbols from the trailing key
  const keys: string[] = []
  let rest = shortcut
  while (rest.length > 0 && MAC_MODIFIERS.has(rest[0]!)) {
    keys.push(rest[0]!)
    rest = rest.slice(1)
  }
  if (rest) keys.push(rest)
  return keys
}

export function KeyboardShortcutsSettings() {
  const { t } = useTranslation('settings')
  const [shortcuts, setShortcuts] = useState<ShortcutInfo[]>([])

  useEffect(() => {
    browser.commands.getAll().then((commands) => {
      setShortcuts(
        commands
          .filter((cmd) => cmd.name !== '_execute_action')
          .map((cmd) => ({
            description: cmd.description ?? cmd.name ?? '',
            shortcut: cmd.shortcut || undefined,
          }))
      )
    })
  }, [])

  const handleChange = () => {
    browser.runtime.sendMessage({ action: 'OPEN_SHORTCUTS_PAGE' })
  }

  return (
    <SettingsSection
      icon={Keyboard}
      iconColor="text-primary"
      iconBgColor="bg-primary/10"
      title={t('shortcuts')}
      description={t('shortcutsDesc')}
    >
      <div className="space-y-3">
        {shortcuts.map((s) => (
          <div key={s.description} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{s.description}</span>
            {s.shortcut ? (
              <kbd className="inline-flex items-center rounded-lg border border-border bg-muted px-2.5 py-1 font-mono text-base text-foreground shadow-sm">
                {parseShortcutKeys(s.shortcut).map((key, i) => (
                  <span key={`${i}-${key}`} className="flex items-center">
                    {i > 0 && <span className="mx-1 text-xs text-muted-foreground/50">+</span>}
                    <span>{key}</span>
                  </span>
                ))}
              </kbd>
            ) : (
              <span className="text-xs text-muted-foreground">{t('shortcutsNotSet')}</span>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleChange}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('shortcutsChange')}
        </button>
      </div>
    </SettingsSection>
  )
}
