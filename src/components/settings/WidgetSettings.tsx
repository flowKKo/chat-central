import { useAtom, useSetAtom } from 'jotai'
import { MessageSquare } from 'lucide-react'
import { configAtom, writeConfigAtom } from '@/utils/atoms/config'
import { SettingsSection } from '../ui/SettingsSection'

export function WidgetSettings() {
  const [config] = useAtom(configAtom)
  const writeConfig = useSetAtom(writeConfigAtom)

  const enabled = config.widget?.enabled ?? true

  const handleToggle = () => {
    writeConfig({ widget: { enabled: !enabled } })
  }

  return (
    <SettingsSection
      icon={MessageSquare}
      iconColor="text-primary"
      iconBgColor="bg-primary/10"
      title="Floating Widget"
      description="Quick access bubble on AI platform pages"
    >
      <label className="flex cursor-pointer items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Show floating widget</p>
          <p className="text-xs text-muted-foreground">
            Display a chat bubble on Claude, ChatGPT, and Gemini pages for quick access to recent
            conversations
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </label>
    </SettingsSection>
  )
}
