import { ExternalLink, Star } from 'lucide-react'
import type { Conversation } from '@/types'
import type { SearchResultWithMatches } from '@/utils/db'
import { browser } from 'wxt/browser'
import { PLATFORM_CONFIG } from '@/types'
import { cn } from '@/utils/cn'
import { HighlightText } from '../HighlightText'

interface ConversationListItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onToggleFavorite: () => void
  searchQuery?: string
  matchInfo?: SearchResultWithMatches
  style?: React.CSSProperties
}

export function ConversationListItem({
  conversation,
  isSelected,
  onClick,
  onToggleFavorite,
  searchQuery,
  matchInfo,
  style,
}: ConversationListItemProps) {
  const platformConfig = PLATFORM_CONFIG[conversation.platform]

  // Get match snippet to display
  const messageMatch = matchInfo?.matches.find((m) => m.type === 'message')
  const hasMessageMatch = !!messageMatch

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={cn(
        'kbd-focus group relative animate-fade-in cursor-pointer p-3.5 transition-all',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
      style={style}
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
          </div>

          {/* Show message match snippet if searching by message content */}
          {hasMessageMatch && searchQuery && (
            <div className="mt-1.5 line-clamp-2 rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
              <HighlightText text={messageMatch.text} query={searchQuery} maxLength={100} />
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          {/* External link button */}
          <button
            className="kbd-focus cursor-pointer rounded-lg p-1.5 opacity-0 transition-colors hover:bg-muted group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              if (conversation.url) {
                browser.tabs.create({ url: conversation.url })
              }
            }}
            aria-label="Open in platform"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {/* Favorite button */}
          <button
            className={cn(
              'kbd-focus cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-muted',
              conversation.isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite()
            }}
            aria-label={conversation.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={conversation.isFavorite}
          >
            <Star
              className={cn(
                'h-4 w-4 transition-colors',
                conversation.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
