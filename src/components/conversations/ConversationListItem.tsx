import { browser } from 'wxt/browser'
import { ExternalLink, Star } from 'lucide-react'
import type { Conversation } from '@/types'
import { PLATFORM_CONFIG } from '@/types'
import { cn } from '@/utils/cn'
import { HighlightText } from '../HighlightText'
import type { SearchResultWithMatches } from '@/utils/db'

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
        'group relative p-3.5 cursor-pointer transition-all animate-fade-in kbd-focus',
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
        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-primary" />
      )}

      <div className="flex items-center gap-3">
        {/* Platform indicator */}
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
            isSelected ? 'scale-105' : 'group-hover:scale-105'
          )}
          style={{ backgroundColor: `${platformConfig.color}15` }}
        >
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: platformConfig.color }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">
            {searchQuery ? (
              <HighlightText text={conversation.title} query={searchQuery} />
            ) : (
              conversation.title
            )}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span className="font-medium" style={{ color: platformConfig.color }}>{platformConfig.name}</span>
            <span className="opacity-40" aria-hidden="true">·</span>
            <span className="tabular-nums">{new Date(conversation.updatedAt).toLocaleDateString()}</span>
          </div>

          {/* Show message match snippet if searching by message content */}
          {hasMessageMatch && searchQuery && (
            <div className="mt-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1 line-clamp-2">
              <HighlightText
                text={messageMatch.text}
                query={searchQuery}
                maxLength={100}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* External link button */}
          <button
            className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer kbd-focus opacity-0 group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              if (conversation.url) {
                browser.tabs.create({ url: conversation.url })
              }
            }}
            aria-label="Open in platform"
          >
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {/* Favorite button */}
          <button
            className={cn(
              'p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer kbd-focus',
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
                'w-4 h-4 transition-colors',
                conversation.isFavorite
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
