import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

interface CheckboxProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  className?: string
  'aria-label'?: string
}

export function Checkbox({
  checked = false,
  onChange,
  className,
  'aria-label': ariaLabel,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation()
        onChange?.(!checked)
      }}
      className={cn(
        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/30 hover:border-primary',
        className
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  )
}
