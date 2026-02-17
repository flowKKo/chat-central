import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Tag } from 'lucide-react'
import { cn } from '@/utils/cn'
import { TagPill } from './ui/TagPill'

const EMPTY_TAGS: string[] = []
const MAX_SUGGESTIONS = 5

interface TagManagerProps {
  /** Current tags */
  tags: string[]
  /** Callback when tags are updated */
  onTagsChange: (tags: string[]) => void
  /** All available tags for autocomplete */
  allTags?: string[]
  /** Whether the component is read-only (display only) */
  readOnly?: boolean
  /** Maximum number of tags to display (shows +N for overflow) */
  maxDisplay?: number
  /** Additional class name */
  className?: string
  /** Compact mode for list items */
  compact?: boolean
}

/**
 * Tag input with autocomplete
 */
function TagInput({
  allTags,
  existingTags,
  onAddTag,
  onClose,
}: {
  allTags: string[]
  existingTags: string[]
  onAddTag: (tag: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('conversations')
  const [inputValue, setInputValue] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Pre-compute Sets for O(1) lookups instead of O(n) array scans
  const existingTagSet = useMemo(() => new Set(existingTags), [existingTags])
  const existingTagLowerSet = useMemo(
    () => new Set(existingTags.map((t) => t.toLowerCase())),
    [existingTags]
  )

  // Filter suggestions based on input
  const suggestions = useMemo(() => {
    const lowerInput = inputValue.toLowerCase().trim()
    if (!lowerInput) return []

    return allTags
      .filter((tag) => tag.toLowerCase().includes(lowerInput) && !existingTagSet.has(tag))
      .slice(0, MAX_SUGGESTIONS)
  }, [inputValue, allTags, existingTagSet])

  // Check if input is a new tag (not in suggestions and not already added)
  const isNewTag = useMemo(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return false
    const lowerInput = trimmed.toLowerCase()
    return (
      !suggestions.some((s) => s.toLowerCase() === lowerInput) &&
      !existingTagLowerSet.has(lowerInput)
    )
  }, [inputValue, suggestions, existingTagLowerSet])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0)
  }, [suggestions])

  const handleSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      if (existingTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return

      onAddTag(trimmed)
      setInputValue('')
    },
    [existingTags, onAddTag]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalOptions = suggestions.length + (isNewTag ? 1 : 0)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, totalOptions - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (isNewTag && selectedIndex === 0) {
          handleSubmit(inputValue)
        } else {
          const suggestionIndex = isNewTag ? selectedIndex - 1 : selectedIndex
          if (suggestions[suggestionIndex]) {
            handleSubmit(suggestions[suggestionIndex])
          } else if (inputValue.trim()) {
            handleSubmit(inputValue)
          }
        }
        break
      case 'Escape':
        onClose()
        break
      case 'Tab':
        if (suggestions.length > 0) {
          e.preventDefault()
          const suggestionIndex = isNewTag ? selectedIndex - 1 : selectedIndex
          if (suggestions[suggestionIndex]) {
            handleSubmit(suggestions[suggestionIndex])
          }
        }
        break
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(onClose, 150)
        }}
        placeholder={t('addTagPlaceholder')}
        className="w-32 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none ring-primary/50 transition-all focus:ring-2"
        aria-label={t('addTag')}
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0 || isNewTag}
      />

      {/* Dropdown */}
      {(suggestions.length > 0 || isNewTag) && (
        <ul
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-1 max-h-40 w-48 overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg"
          role="listbox"
        >
          {isNewTag && (
            <li
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                selectedIndex === 0 ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
              )}
              onClick={() => handleSubmit(inputValue)}
              role="option"
              aria-selected={selectedIndex === 0}
            >
              <Plus className="h-3 w-3" />
              {t('createTag', { tag: inputValue.trim() })}
            </li>
          )}
          {suggestions.map((tag, index) => {
            const optionIndex = isNewTag ? index + 1 : index
            return (
              <li
                key={tag}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                  selectedIndex === optionIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                )}
                onClick={() => handleSubmit(tag)}
                role="option"
                aria-selected={selectedIndex === optionIndex}
              >
                <Tag className="h-3 w-3" />
                {tag}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * TagManager component for managing conversation tags
 */
export function TagManager({
  tags,
  onTagsChange,
  allTags = EMPTY_TAGS,
  readOnly = false,
  maxDisplay,
  className,
  compact = false,
}: TagManagerProps) {
  const { t } = useTranslation('conversations')
  const [isAdding, setIsAdding] = useState(false)

  const displayTags = maxDisplay ? tags.slice(0, maxDisplay) : tags
  const overflowCount = maxDisplay ? Math.max(0, tags.length - maxDisplay) : 0

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onTagsChange(tags.filter((t) => t !== tagToRemove))
    },
    [tags, onTagsChange]
  )

  const handleAddTag = useCallback(
    (newTag: string) => {
      if (!tags.includes(newTag)) {
        onTagsChange([...tags, newTag])
      }
    },
    [tags, onTagsChange]
  )

  // If no tags and read-only, don't render anything
  if (tags.length === 0 && readOnly) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {displayTags.map((tag) => (
        <TagPill
          key={tag}
          tag={tag}
          onRemove={readOnly ? undefined : () => handleRemoveTag(tag)}
          readOnly={readOnly}
          compact={compact}
        />
      ))}

      {overflowCount > 0 && (
        <span
          className={cn(
            'rounded-full bg-muted text-muted-foreground',
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
          )}
        >
          +{overflowCount}
        </span>
      )}

      {!readOnly && !isAdding && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary',
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          )}
          aria-label={t('addTag')}
        >
          <Plus className={cn(compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
          <span>{t('common:add')}</span>
        </button>
      )}

      {!readOnly && isAdding && (
        <TagInput
          allTags={allTags}
          existingTags={tags}
          onAddTag={handleAddTag}
          onClose={() => setIsAdding(false)}
        />
      )}
    </div>
  )
}
