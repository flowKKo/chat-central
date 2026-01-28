import { useAtom } from 'jotai'
import { Monitor, Moon, Sun } from 'lucide-react'
import { type ThemePreference, themePreferenceAtom } from '@/utils/atoms/theme'
import { cn } from '@/utils/cn'
import { SettingsSection } from '../ui/SettingsSection'

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function AppearanceSettings() {
  const [themePreference, setThemePreference] = useAtom(themePreferenceAtom)

  return (
    <SettingsSection
      icon={Sun}
      iconColor="text-primary"
      iconBgColor="bg-primary/10"
      title="Appearance"
      description="Customize how the app looks"
    >
      <div className="flex gap-3" role="radiogroup" aria-label="Theme selection">
        {themeOptions.map((option) => {
          const Icon = option.icon
          const isSelected = themePreference === option.value
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
              onClick={() => setThemePreference(option.value)}
            >
              <Icon
                className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-muted-foreground')}
              />
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
