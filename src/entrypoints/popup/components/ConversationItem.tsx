import { useAtom } from 'jotai'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { browser } from 'wxt/browser'
import { HighlightText } from '@/components/HighlightText'
import type { Conversation, Platform } from '@/types'
import { PLATFORM_CONFIG } from '@/types'
import { toggleFavoriteAtom } from '@/utils/atoms'
import { cn } from '@/utils/cn'
import type { SearchResultWithMatches } from '@/utils/db'
import { formatRelativeDate } from '../utils/formatDate'

interface ConversationItemProps {
  conversation: Conversation
  searchQuery?: string
  matchInfo?: SearchResultWithMatches
}

export function ConversationItem({ conversation, searchQuery, matchInfo }: ConversationItemProps) {
  const { t } = useTranslation('conversations')
  const platformConfig = PLATFORM_CONFIG[conversation.platform as Platform]
  const [, toggleFavorite] = useAtom(toggleFavoriteAtom)

  // Get message match snippet
  const messageMatch = matchInfo?.matches.find((m) => m.type === 'message')
  const hasMessageMatch = !!messageMatch

  const handleClick = () => {
    if (conversation.url) {
      browser.tabs.create({ url: conversation.url })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      role="listitem"
      tabIndex={0}
      className="kbd-focus group relative cursor-pointer rounded-xl px-2.5 py-3 transition-all hover:bg-muted"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Platform indicator line */}
      <div
        className="absolute bottom-3 left-0.5 top-3 w-0.5 rounded-full"
        style={{ backgroundColor: platformConfig.color }}
        aria-hidden="true"
      />

      <div className="flex items-start gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 min-w-0 truncate text-sm font-medium text-foreground">
            {searchQuery ? (
              <HighlightText text={conversation.title} query={searchQuery} />
            ) : (
              conversation.title
            )}
          </h3>

          {/* Show message match snippet if available, otherwise show summary/preview */}
          {hasMessageMatch && searchQuery ? (
            <div className="mb-2 line-clamp-2 rounded-md bg-muted/50 px-2 py-1 text-xs leading-relaxed text-muted-foreground">
              <HighlightText text={messageMatch.text} query={searchQuery} maxLength={80} />
            </div>
          ) : conversation.summary || conversation.preview ? (
            <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {searchQuery ? (
                <HighlightText
                  text={conversation.summary || conversation.preview}
                  query={searchQuery}
                  maxLength={100}
                />
              ) : (
                conversation.summary || conversation.preview
              )}
            </p>
          ) : null}

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium" style={{ color: platformConfig.color }}>
              {platformConfig.name}
            </span>
            <span className="opacity-50" aria-hidden="true">
              ·
            </span>
            <span>{formatRelativeDate(conversation.updatedAt)}</span>
            {conversation.messageCount > 0 && (
              <>
                <span className="opacity-50" aria-hidden="true">
                  ·
                </span>
                <span>{t('common:messagesCount', { count: conversation.messageCount })}</span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className={cn(
            'kbd-focus flex-shrink-0 cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-accent',
            conversation.isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          onClick={(event) => {
            event.stopPropagation()
            toggleFavorite(conversation.id)
          }}
          aria-label={conversation.isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
          aria-pressed={conversation.isFavorite}
        >
          <Star
            className={cn(
              'h-3.5 w-3.5 transition-colors',
              conversation.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
            )}
          />
        </button>
      </div>
    </div>
  )
}
