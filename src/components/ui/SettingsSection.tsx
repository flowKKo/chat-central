import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface SettingsSectionProps {
  icon: LucideIcon
  iconColor: string
  iconBgColor: string
  title: string
  description: string
  children: React.ReactNode
  className?: string
}

export function SettingsSection({
  icon: Icon,
  iconColor,
  iconBgColor,
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card/50 p-5', className)}>
      <div className="mb-3 flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', iconBgColor)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <div>
          <h2 className="font-heading text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
