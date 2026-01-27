import { cn } from '@/utils/cn'

interface TooltipProps {
  label: string
  children: React.ReactNode
  position?: 'top' | 'bottom'
  className?: string
}

export function Tooltip({ label, children, position = 'bottom', className }: TooltipProps) {
  return (
    <div className={cn('group/tooltip relative', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover/tooltip:opacity-100',
          position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
        )}
      >
        {label}
      </span>
    </div>
  )
}
