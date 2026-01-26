import { useAtom } from 'jotai'
import {
  Search,
  Settings,
  ExternalLink,
  Star,
  MessageSquare,
  ArrowRight,
  Sparkles,
  X,
  Github,
} from 'lucide-react'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { browser } from 'wxt/browser'
import type { SearchResultWithMatches } from '@/utils/db'
import { MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY } from '@/utils/date'
import { HighlightText } from '@/components/HighlightText'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ConflictResolverModal, SyncSettingsModal, SyncStatusBar } from '@/components/sync'
import { type Conversation, type Platform, PLATFORM_CONFIG } from '@/types'
import {
  activeSearchQueryAtom,
  conversationCountsAtom,
  conversationsAtom,
  isLoadingConversationsAtom,
  loadConversationsAtom,
  paginationAtom,
  performSearchAtom,
  searchResultsAtom,
  toggleFavoriteAtom,
  currentPlatformFilterAtom,
  setPlatformFilterAtom,
} from '@/utils/atoms'
import { initializeSyncAtom } from '@/utils/atoms/sync'
import { cn } from '@/utils/cn'
import { filterAndSortConversations } from '@/utils/filters'

export default function App() {
  const [conversations] = useAtom(conversationsAtom)
  const [counts] = useAtom(conversationCountsAtom)
  const [, loadConversations] = useAtom(loadConversationsAtom)
  const [pagination] = useAtom(paginationAtom)
  const [isLoading] = useAtom(isLoadingConversationsAtom)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform] = useAtom(currentPlatformFilterAtom)
  const [, setPlatformFilter] = useAtom(setPlatformFilterAtom)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [, initializeSync] = useAtom(initializeSyncAtom)
  const [, performSearch] = useAtom(performSearchAtom)
  const [activeSearchQuery] = useAtom(activeSearchQueryAtom)
  const [searchResults] = useAtom(searchResultsAtom)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadConversations({ reset: true })
    initializeSync()
  }, [loadConversations, initializeSync])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, performSearch])

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Use shared filtering and sorting utilities
  // Note: platform filtering is now done at DB level, so we don't filter here
  const sortedConversations = useMemo(
    () =>
      filterAndSortConversations(
        conversations,
        { favoritesOnly: showFavoritesOnly },
        { byFavoriteTime: showFavoritesOnly },
      ),
    [conversations, showFavoritesOnly],
  )
  const filteredConversations = sortedConversations

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    searchInputRef.current?.focus()
  }, [])

  return (
    <ThemeProvider>
      <div className="flex max-h-[600px] min-h-[520px] w-[420px] flex-col bg-background text-foreground">
        {/* Header */}
        <header className="relative bg-card px-4 pb-3 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="font-heading text-base font-semibold text-foreground">
                  Chat Central
                </h1>
                <p className="text-[11px] text-muted-foreground">AI Conversation Manager</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="kbd-focus cursor-pointer rounded-lg p-2 transition-colors hover:bg-muted"
                onClick={() =>
                  browser.tabs.create({ url: 'https://github.com/flowKKo/chat-central' })}
                aria-label="View on GitHub"
              >
                <Github className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                type="button"
                className="kbd-focus cursor-pointer rounded-lg p-2 transition-colors hover:bg-muted"
                onClick={() =>
                  browser.tabs.create({ url: browser.runtime.getURL('/manage.html#/settings') })}
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <label htmlFor="search-input" className="sr-only">
              Search conversations
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              id="search-input"
              type="text"
              placeholder="Search conversations... (⌘K)"
              className="w-full rounded-xl border border-border bg-muted py-2.5 pl-9 pr-8 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 transition-colors hover:bg-accent"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </header>

        {/* Platform Filter Tabs */}
        <div
          className="border-b border-border bg-card px-3 py-2"
          role="tablist"
          aria-label="Filter by platform"
        >
          <div className="flex items-center gap-1">
            <PlatformTab
              label="All"
              count={counts.total}
              isActive={selectedPlatform === 'all' && !showFavoritesOnly}
              onClick={() => {
                setShowFavoritesOnly(false)
                setPlatformFilter('all')
              }}
            />
            {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
              <PlatformTab
                key={platform}
                platform={platform}
                count={counts[platform]}
                isActive={selectedPlatform === platform && !showFavoritesOnly}
                onClick={() => {
                  setShowFavoritesOnly(false)
                  setPlatformFilter(platform)
                }}
              />
            ))}
            <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={showFavoritesOnly}
              className={cn(
                'kbd-focus flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                showFavoritesOnly
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              onClick={() => setShowFavoritesOnly(true)}
            >
              <Star className={cn('h-3.5 w-3.5', showFavoritesOnly && 'fill-amber-400')} />
              <span>Favorites</span>
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div
          className="scrollbar-thin flex-1 overflow-y-auto bg-background"
          role="list"
          aria-label="Conversations"
        >
          {isLoading && conversations.length === 0
            ? (
                <LoadingSkeleton />
              )
            : filteredConversations.length === 0
              ? (
                  <EmptyState searchQuery={searchQuery} onClearSearch={clearSearch} />
                )
              : (
                  <div className="space-y-1 p-2">
                    {sortedConversations.map((conv, index) => {
                      const matchInfo = searchResults.find((r) => r.conversation.id === conv.id)
                      return (
                        <ConversationItem
                          key={conv.id}
                          conversation={conv}
                          searchQuery={activeSearchQuery}
                          matchInfo={matchInfo}
                          style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                        />
                      )
                    })}
                    {pagination.hasMore && (
                      <div className="pb-1 pt-2">
                        <button
                          type="button"
                          className="kbd-focus w-full cursor-pointer rounded-xl border border-dashed border-border px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                          onClick={() => loadConversations()}
                          disabled={isLoading}
                        >
                          {isLoading
                            ? (
                                <span className="flex items-center justify-center gap-2">
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                                  Loading...
                                </span>
                              )
                            : (
                                'Load more conversations'
                              )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
        </div>

        {/* Footer */}
        <footer className="border-t border-border bg-card px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="font-medium tabular-nums text-foreground">{counts.total}</span>
                <span>conversations</span>
              </div>
              <SyncStatusBar />
            </div>
            <button
              type="button"
              className="kbd-focus group flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              onClick={() =>
                browser.tabs.create({ url: browser.runtime.getURL('/manage.html#/conversations') })}
            >
              Manage
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </footer>

        {/* Modals */}
        <SyncSettingsModal />
        <ConflictResolverModal />
      </div>
    </ThemeProvider>
  )
}

function PlatformTab({
  label,
  platform,
  count,
  isActive,
  onClick,
}: {
  label?: string
  platform?: Platform
  count: number
  isActive: boolean
  onClick: () => void
}) {
  const config = platform ? PLATFORM_CONFIG[platform] : null
  const displayLabel = label || config?.name || ''

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={cn(
        'kbd-focus flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
        isActive
          ? platform
            ? 'text-foreground'
            : 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      style={
        isActive && platform
          ? { backgroundColor: `${config?.color}25`, color: config?.color }
          : undefined
      }
      onClick={onClick}
    >
      {platform && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: config?.color }}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
      <span className={cn('text-[10px] tabular-nums', isActive ? 'opacity-90' : 'opacity-70')}>
        {count}
      </span>
    </button>
  )
}

function ConversationItem({
  conversation,
  searchQuery,
  matchInfo,
  style,
}: {
  conversation: Conversation
  searchQuery?: string
  matchInfo?: SearchResultWithMatches
  style?: React.CSSProperties
}) {
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
      className="kbd-focus group relative animate-fade-in cursor-pointer rounded-xl p-3 transition-all hover:bg-muted"
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Platform indicator line */}
      <div
        className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full"
        style={{ backgroundColor: platformConfig.color }}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {searchQuery
                ? (
                    <HighlightText text={conversation.title} query={searchQuery} />
                  )
                : (
                    conversation.title
                  )}
            </h3>
            <ExternalLink
              className="h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </div>

          {/* Show message match snippet if available, otherwise show summary/preview */}
          {hasMessageMatch && searchQuery
            ? (
                <div className="mb-2 line-clamp-2 rounded-md bg-muted/50 px-2 py-1 text-xs leading-relaxed text-muted-foreground">
                  <HighlightText text={messageMatch.text} query={searchQuery} maxLength={80} />
                </div>
              )
            : conversation.summary || conversation.preview
              ? (
                  <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {searchQuery
                      ? (
                          <HighlightText
                            text={conversation.summary || conversation.preview}
                            query={searchQuery}
                            maxLength={100}
                          />
                        )
                      : (
                          conversation.summary || conversation.preview
                        )}
                  </p>
                )
              : null}

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium" style={{ color: platformConfig.color }}>
              {platformConfig.name}
            </span>
            <span className="opacity-50" aria-hidden="true">
              ·
            </span>
            <span>{formatDate(conversation.updatedAt)}</span>
            {conversation.messageCount > 0 && (
              <>
                <span className="opacity-50" aria-hidden="true">
                  ·
                </span>
                <span>
                  {conversation.messageCount}
                  {' '}
                  messages
                </span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className={cn(
            'kbd-focus flex-shrink-0 cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-accent',
            conversation.isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
          onClick={(event) => {
            event.stopPropagation()
            toggleFavorite(conversation.id)
          }}
          aria-label={conversation.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={conversation.isFavorite}
        >
          <Star
            className={cn(
              'h-3.5 w-3.5 transition-colors',
              conversation.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
            )}
          />
        </button>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading conversations">
      {['s1', 's2', 's3', 's4', 's5'].map((id) => (
        <div key={id} className="rounded-xl p-3">
          <div className="flex items-start gap-3 pl-2">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  searchQuery,
  onClearSearch,
}: {
  searchQuery: string
  onClearSearch: () => void
}) {
  return (
    <div className="flex h-full animate-fade-in flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      {searchQuery
        ? (
            <>
              <h3 className="mb-1 font-heading font-medium text-foreground">No results found</h3>
              <p className="mb-4 text-sm text-muted-foreground">Try a different search term</p>
              <button
                type="button"
                className="kbd-focus cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                onClick={onClearSearch}
              >
                Clear search
              </button>
            </>
          )
        : (
            <>
              <h3 className="mb-1 font-heading font-medium text-foreground">No conversations yet</h3>
              <p className="mb-4 max-w-[240px] text-sm text-muted-foreground">
                Visit Claude, ChatGPT, or Gemini to start syncing your conversations
              </p>
              <div className="flex items-center gap-2">
                {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
                  <button
                    type="button"
                    key={platform}
                    className="kbd-focus flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    style={{ color: PLATFORM_CONFIG[platform].color }}
                    onClick={() => browser.tabs.create({ url: PLATFORM_CONFIG[platform].baseUrl })}
                    aria-label={`Open ${PLATFORM_CONFIG[platform].name}`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
                    />
                    {PLATFORM_CONFIG[platform].name}
                  </button>
                ))}
              </div>
            </>
          )}
    </div>
  )
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / MS_PER_MINUTE)
  const hours = Math.floor(diff / MS_PER_HOUR)
  const days = Math.floor(diff / MS_PER_DAY)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}
