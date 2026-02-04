import { useTranslation } from 'react-i18next'
import { ExternalLink, Star } from 'lucide-react'
import type { Conversation } from '@/types'
import type { SearchResultWithMatches } from '@/utils/db'
import { browser } from 'wxt/browser'
import { PLATFORM_CONFIG } from '@/types'
import { cn } from '@/utils/cn'
import { HighlightText } from '../HighlightText'
import { TagPill } from '../ui/TagPill'
import { Checkbox } from '../ui/Checkbox'

interface ConversationListItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onToggleFavorite: () => void
  searchQuery?: string
  matchInfo?: SearchResultWithMatches
  /** Whether batch selection mode is active */
  isBatchMode?: boolean
  /** Whether this item is checked in batch mode */
  isChecked?: boolean
  /** Callback to toggle batch selection */
  onToggleCheck?: () => void
}

export function ConversationListItem({
  conversation,
  isSelected,
  onClick,
  onToggleFavorite,
  searchQuery,
  matchInfo,
  isBatchMode = false,
  isChecked = false,
  onToggleCheck,
}: ConversationListItemProps) {
  const { t } = useTranslation('conversations')
  const platformConfig = PLATFORM_CONFIG[conversation.platform]

  // Get match snippet to display
  const messageMatch = matchInfo?.matches.find((m) => m.type === 'message')
  const hasMessageMatch = !!messageMatch
  const hasSummaryMatch = !!(
    searchQuery &&
    conversation.summary &&
    conversation.summary.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={cn(
        'kbd-focus group relative cursor-pointer p-3.5 transition-all',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full bg-primary" />
      )}

      <div className="flex items-center gap-3">
        {/* Batch selection checkbox */}
        {isBatchMode && (
          <Checkbox
            checked={isChecked}
            onChange={onToggleCheck}
            aria-label={t('select', { title: conversation.title })}
          />
        )}

        {/* Platform indicator */}
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all',
            isSelected ? 'scale-105' : 'group-hover:scale-105'
          )}
          style={{ backgroundColor: `${platformConfig.color}15` }}
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: platformConfig.color }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">
            {searchQuery ? (
              <HighlightText text={conversation.title} query={searchQuery} />
            ) : (
              conversation.title
            )}
          </h3>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium" style={{ color: platformConfig.color }}>
              {platformConfig.name}
            </span>
            <span className="opacity-40" aria-hidden="true">
              ·
            </span>
            <span className="tabular-nums">
              {new Date(conversation.updatedAt).toLocaleDateString()}
            </span>

            {/* Action buttons — inline, far right */}
            <div className="-my-1 ml-auto flex items-center gap-0.5">
              <button
                type="button"
                className="kbd-focus cursor-pointer rounded-md p-1 opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation()
                  if (conversation.url) {
                    browser.tabs.create({ url: conversation.url })
                  }
                }}
                aria-label={t('openInPlatform')}
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                className={cn(
                  'kbd-focus cursor-pointer rounded-md p-1 transition-all hover:bg-muted',
                  conversation.isFavorite ? '' : 'opacity-0 group-hover:opacity-100'
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleFavorite()
                }}
                aria-label={
                  conversation.isFavorite ? t('removeFromFavorites') : t('addToFavorites')
                }
                aria-pressed={conversation.isFavorite}
              >
                <Star
                  className={cn(
                    'h-3.5 w-3.5 transition-colors',
                    conversation.isFavorite
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground'
                  )}
                />
              </button>
            </div>
          </div>

          {/* Search result snippet or default summary/preview */}
          {searchQuery ? (
            hasMessageMatch ? (
              <div className="mt-1.5 line-clamp-2 rounded-md bg-muted/50 px-2 py-1 text-xs leading-relaxed text-muted-foreground">
                <HighlightText text={messageMatch.text} query={searchQuery} maxLength={120} />
              </div>
            ) : hasSummaryMatch ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
                <HighlightText text={conversation.summary!} query={searchQuery} maxLength={120} />
              </p>
            ) : conversation.preview ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
                <HighlightText text={conversation.preview} query={searchQuery} maxLength={120} />
              </p>
            ) : null
          ) : (
            (conversation.summary || conversation.preview) && (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
                {conversation.summary || conversation.preview}
              </p>
            )
          )}

          {/* Tags display */}
          {conversation.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {conversation.tags.slice(0, 3).map((tag) => (
                <TagPill key={tag} tag={tag} compact readOnly />
              ))}
              {conversation.tags.length > 3 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  +{conversation.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
