import { useEffect, useState, useRef, useMemo } from 'react'
import { useAtom } from 'jotai'
import {
  Search,
  RefreshCw,
  Filter,
  MessageSquare,
  ChevronDown,
  X,
} from 'lucide-react'
import {
  conversationsAtom,
  loadConversationsAtom,
  conversationCountsAtom,
  selectedConversationAtom,
  selectedMessagesAtom,
  loadConversationDetailAtom,
  paginationAtom,
  isLoadingConversationsAtom,
  favoritesConversationsAtom,
  loadFavoritesAtom,
  favoriteCountsAtom,
  favoritesPaginationAtom,
  isLoadingFavoritesAtom,
  loadFavoriteDetailAtom,
  toggleFavoriteAtom,
  performSearchAtom,
  activeSearchQueryAtom,
  searchResultsAtom,
} from '@/utils/atoms'
import { PLATFORM_CONFIG, type Platform } from '@/types'
import { cn } from '@/utils/cn'
import { filterAndSortConversations } from '@/utils/filters'
import {
  ConversationListItem,
  ConversationDetail,
  ConversationListSkeleton,
} from './conversations'

export default function ConversationsManager({ mode = 'all' }: { mode?: 'all' | 'favorites' }) {
  const isFavorites = mode === 'favorites'
  const [conversations] = useAtom(
    isFavorites ? favoritesConversationsAtom : conversationsAtom
  )
  const [counts] = useAtom(isFavorites ? favoriteCountsAtom : conversationCountsAtom)
  const [, loadConversations] = useAtom(isFavorites ? loadFavoritesAtom : loadConversationsAtom)
  const [selectedConversation] = useAtom(selectedConversationAtom)
  const [selectedMessages] = useAtom(selectedMessagesAtom)
  const [, loadDetail] = useAtom(isFavorites ? loadFavoriteDetailAtom : loadConversationDetailAtom)
  const [pagination] = useAtom(isFavorites ? favoritesPaginationAtom : paginationAtom)
  const [isLoading] = useAtom(isFavorites ? isLoadingFavoritesAtom : isLoadingConversationsAtom)
  const [, toggleFavorite] = useAtom(toggleFavoriteAtom)
  const [, searchConversations] = useAtom(performSearchAtom)
  const [activeSearchQuery] = useAtom(activeSearchQueryAtom)
  const [searchResults] = useAtom(searchResultsAtom)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations({ reset: true })
  }, [loadConversations])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isFavorites) {
        searchConversations(searchQuery)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchConversations, isFavorites])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false)
      }
    }

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isFilterOpen])

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false)
      }
    }

    if (isFilterOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isFilterOpen])

  // Use shared filtering and sorting utilities
  const sortedConversations = useMemo(
    () => filterAndSortConversations(
      conversations,
      {
        platform: selectedPlatform,
        // Only apply local search filter in favorites mode (full search handled by atoms)
        searchQuery: isFavorites ? searchQuery : undefined,
      },
      { byFavoriteTime: isFavorites }
    ),
    [conversations, selectedPlatform, isFavorites, searchQuery]
  )
  const filteredConversations = sortedConversations

  const emptyLabel = isFavorites ? 'No favorites yet' : 'No conversations found'
  const pageTitle = isFavorites ? 'Favorites' : 'Conversations'

  return (
    <div className="h-full">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold tracking-tight mb-1">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {isFavorites
            ? 'Your starred conversations for quick access'
            : 'Browse and manage all your AI conversations'}
        </p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-180px)]">
        {/* Left: Conversation List */}
        <div className="w-[380px] flex-shrink-0 flex flex-col">
          {/* Search and Filters */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <label htmlFor="manage-search" className="sr-only">Search conversations</label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                id="manage-search"
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-10 pr-8 py-2.5 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Platform Filter Dropdown */}
              <div className="relative flex-1" ref={filterRef}>
                <button
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm hover:bg-muted/80 transition-colors cursor-pointer kbd-focus"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={isFilterOpen}
                  aria-label="Filter by platform"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {selectedPlatform === 'all'
                        ? `All Platforms (${counts.total})`
                        : `${PLATFORM_CONFIG[selectedPlatform].name} (${counts[selectedPlatform]})`}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform duration-200',
                      isFilterOpen && 'rotate-180'
                    )}
                  />
                </button>

                {isFilterOpen && (
                  <div
                    role="listbox"
                    className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden animate-scale-in"
                  >
                    <button
                      role="option"
                      aria-selected={selectedPlatform === 'all'}
                      className={cn(
                        'w-full px-3 py-2.5 text-sm text-left hover:bg-muted/80 transition-colors cursor-pointer',
                        selectedPlatform === 'all' && 'bg-primary/10 text-primary'
                      )}
                      onClick={() => {
                        setSelectedPlatform('all')
                        setIsFilterOpen(false)
                      }}
                    >
                      All Platforms ({counts.total})
                    </button>
                    {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
                      <button
                        key={platform}
                        role="option"
                        aria-selected={selectedPlatform === platform}
                        className={cn(
                          'w-full px-3 py-2.5 text-sm text-left hover:bg-muted/80 transition-colors cursor-pointer flex items-center gap-2',
                          selectedPlatform === platform && 'bg-primary/10 text-primary'
                        )}
                        onClick={() => {
                          setSelectedPlatform(platform)
                          setIsFilterOpen(false)
                        }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
                        />
                        {PLATFORM_CONFIG[platform].name} ({counts[platform]})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className={cn(
                  'p-2.5 border border-border rounded-xl hover:bg-muted/80 transition-all cursor-pointer kbd-focus',
                  isLoading && 'animate-pulse'
                )}
                onClick={() => loadConversations({ reset: true })}
                aria-label="Refresh conversations"
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 border border-border rounded-2xl overflow-hidden bg-card/30">
            <div className="h-full overflow-y-auto scrollbar-thin" role="list" aria-label="Conversation list">
              {isLoading && conversations.length === 0 ? (
                <ConversationListSkeleton />
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <MessageSquare className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{emptyLabel}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {sortedConversations.map((conv, index) => {
                    const matchInfo = searchResults.find((r) => r.conversation.id === conv.id)
                    const messageMatch = matchInfo?.matches.find((m) => m.type === 'message')
                    return (
                      <ConversationListItem
                        key={conv.id}
                        conversation={conv}
                        isSelected={selectedConversation?.id === conv.id}
                        onClick={() => loadDetail(conv.id, messageMatch?.messageId)}
                        onToggleFavorite={() => toggleFavorite(conv.id)}
                        searchQuery={activeSearchQuery}
                        matchInfo={matchInfo}
                        style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Load More */}
          {pagination.hasMore && (
            <div className="mt-3">
              <button
                className="w-full px-4 py-2.5 text-sm font-medium text-muted-foreground border border-dashed border-border rounded-xl hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer kbd-focus"
                onClick={() => loadConversations()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                    Loading...
                  </span>
                ) : (
                  'Load more conversations'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right: Detail View */}
        <div className="flex-1 min-w-0">
          {selectedConversation ? (
            <ConversationDetail
              conversation={selectedConversation}
              messages={selectedMessages}
              searchQuery={activeSearchQuery}
            />
          ) : (
            <div className="h-full border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium mb-1">Select a conversation</p>
              <p className="text-xs text-muted-foreground/60">
                Choose from the list to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
