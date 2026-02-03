import { MessageSquare } from 'lucide-react'
import type { Conversation } from '@/types'
import type { SearchResultWithMatches } from '@/utils/db'
import { ConversationListItem } from './ConversationListItem'
import { ConversationListSkeleton } from './ConversationListSkeleton'

interface ConversationListProps {
  conversations: Conversation[]
  isLoading: boolean
  hasLoadedConversations: boolean
  emptyLabel: string
  selectedConversationId: string | undefined
  searchQuery: string | undefined
  searchResultsMap: Map<string, SearchResultWithMatches>
  isBatchMode: boolean
  batchSelectedIds: ReadonlySet<string>
  onItemClick: (conversationId: string, messageId: string | undefined) => void
  onToggleFavorite: (conversationId: string) => void
  onToggleBatchSelect: (conversationId: string) => void
  hasMore: boolean
  onLoadMore: () => void
}

export function ConversationList({
  conversations,
  isLoading,
  hasLoadedConversations,
  emptyLabel,
  selectedConversationId,
  searchQuery,
  searchResultsMap,
  isBatchMode,
  batchSelectedIds,
  onItemClick,
  onToggleFavorite,
  onToggleBatchSelect,
  hasMore,
  onLoadMore,
}: ConversationListProps) {
  return (
    <>
      {/* Conversation List */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-border bg-card/30">
        <div
          className="scrollbar-thin h-full overflow-y-auto"
          role="list"
          aria-label="Conversation list"
        >
          {isLoading && !hasLoadedConversations ? (
            <ConversationListSkeleton />
          ) : conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
                <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {conversations.map((conv) => {
                const matchInfo = searchResultsMap.get(conv.id)
                const messageMatch = matchInfo?.matches.find((m) => m.type === 'message')
                return (
                  <ConversationListItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedConversationId === conv.id}
                    onClick={() => {
                      if (isBatchMode) {
                        onToggleBatchSelect(conv.id)
                      } else {
                        onItemClick(conv.id, messageMatch?.messageId)
                      }
                    }}
                    onToggleFavorite={() => onToggleFavorite(conv.id)}
                    searchQuery={searchQuery}
                    matchInfo={matchInfo}
                    isBatchMode={isBatchMode}
                    isChecked={batchSelectedIds.has(conv.id)}
                    onToggleCheck={() => onToggleBatchSelect(conv.id)}
                  />
                )
              })}
            </div>
          )}

          {/* Load More — inside scroll area so it appears at the bottom */}
          {hasMore && conversations.length > 0 && (
            <div className="p-3">
              <button
                type="button"
                className="kbd-focus w-full cursor-pointer rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                    Loading...
                  </span>
                ) : (
                  'Load more conversations'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
