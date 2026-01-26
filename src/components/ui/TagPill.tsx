import { Tag, X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface TagPillProps {
  /** The tag text to display */
  tag: string
  /** Callback when remove button is clicked */
  onRemove?: () => void
  /** Whether the component is read-only (no remove button) */
  readOnly?: boolean
  /** Compact mode for list items */
  compact?: boolean
  /** Additional class name */
  className?: string
}

/**
 * Tag pill component for display
 * Shared between TagManager and ConversationListItem
 */
export function TagPill({ tag, onRemove, readOnly, compact, className }: TagPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary transition-colors',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        !readOnly && 'group hover:bg-primary/20',
        className,
      )}
    >
      <Tag className={cn('flex-shrink-0', compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      <span className={cn('truncate', compact ? 'max-w-[60px]' : 'max-w-[100px]')}>{tag}</span>
      {!readOnly && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 flex-shrink-0 rounded-full p-0.5 opacity-60 transition-opacity hover:bg-primary/20 hover:opacity-100"
          aria-label={`Remove tag ${tag}`}
        >
          <X className={cn(compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        </button>
      )}
    </span>
  )
}
