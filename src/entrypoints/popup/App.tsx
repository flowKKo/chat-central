import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { useAtom } from 'jotai'
import {
  Search,
  Settings,
  ExternalLink,
  Star,
  MessageSquare,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import {
  conversationsAtom,
  loadConversationsAtom,
  conversationCountsAtom,
  paginationAtom,
  isLoadingConversationsAtom,
  toggleFavoriteAtom,
} from '@/utils/atoms'
import { initializeSyncAtom } from '@/utils/atoms/sync'
import { PLATFORM_CONFIG, type Platform, type Conversation } from '@/types'
import { cn } from '@/utils/cn'
import { SyncStatusBar, SyncSettingsModal, ConflictResolverModal } from '@/components/sync'

export default function App() {
  const [conversations] = useAtom(conversationsAtom)
  const [counts] = useAtom(conversationCountsAtom)
  const [, loadConversations] = useAtom(loadConversationsAtom)
  const [pagination] = useAtom(paginationAtom)
  const [isLoading] = useAtom(isLoadingConversationsAtom)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [, initializeSync] = useAtom(initializeSyncAtom)

  useEffect(() => {
    loadConversations({ reset: true })
    initializeSync()
  }, [loadConversations, initializeSync])

  const filteredConversations = conversations.filter((conv) => {
    if (selectedPlatform !== 'all' && conv.platform !== selectedPlatform) {
      return false
    }
    if (showFavoritesOnly && !conv.isFavorite) {
      return false
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        conv.title.toLowerCase().includes(query) || conv.preview.toLowerCase().includes(query)
      )
    }
    return true
  })

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const primaryA = showFavoritesOnly ? a.favoriteAt ?? 0 : a.updatedAt ?? 0
    const primaryB = showFavoritesOnly ? b.favoriteAt ?? 0 : b.updatedAt ?? 0
    if (primaryA !== primaryB) return primaryB - primaryA
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  })

  return (
    <div className="dark w-[400px] min-h-[520px] max-h-[600px] flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="relative px-4 pt-4 pb-3">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        <div className="relative flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center shadow-glow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-heading font-semibold tracking-tight">Chat Central</h1>
              <p className="text-[10px] text-muted-foreground">AI Conversation Manager</p>
            </div>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-muted/80 transition-colors cursor-pointer focus-ring"
            onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/manage.html#/settings') })}
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      {/* Platform Filter Tabs */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-1">
          <PlatformTab
            label="All"
            count={counts.total}
            isActive={selectedPlatform === 'all'}
            onClick={() => setSelectedPlatform('all')}
          />
          {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
            <PlatformTab
              key={platform}
              platform={platform}
              count={counts[platform]}
              isActive={selectedPlatform === platform}
              onClick={() => setSelectedPlatform(platform)}
            />
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <button
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer',
              showFavoritesOnly
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            )}
            onClick={() => setShowFavoritesOnly((value) => !value)}
            title="Show favorites"
          >
            <Star className={cn('w-3.5 h-3.5', showFavoritesOnly && 'fill-amber-400')} />
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredConversations.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : (
          <div className="p-2 space-y-1">
            {sortedConversations.map((conv, index) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                style={{ animationDelay: `${index * 30}ms` }}
              />
            ))}
            {pagination.hasMore && (
              <div className="pt-2 pb-1">
                <button
                  className="w-full px-3 py-2 text-xs font-medium text-muted-foreground border border-dashed border-border rounded-lg hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
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
        )}
      </div>

      {/* Footer */}
      <footer className="px-3 py-2.5 border-t border-border/50 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="font-medium">{counts.total}</span>
              <span>conversations</span>
            </div>
            <SyncStatusBar />
          </div>
          <button
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer group"
            onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/manage.html#/conversations') })}
          >
            Manage
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </footer>

      {/* Modals */}
      <SyncSettingsModal />
      <ConflictResolverModal />
    </div>
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
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer',
        isActive
          ? platform
            ? 'text-foreground'
            : 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
      )}
      style={
        isActive && platform
          ? { backgroundColor: `${config?.color}20`, color: config?.color }
          : undefined
      }
      onClick={onClick}
    >
      {platform && (
        <span
          className={cn('w-2 h-2 rounded-full', !isActive && 'opacity-60')}
          style={{ backgroundColor: config?.color }}
        />
      )}
      <span>{displayLabel}</span>
      <span className={cn('text-[10px]', isActive ? 'opacity-80' : 'opacity-50')}>
        {count}
      </span>
    </button>
  )
}

function ConversationItem({
  conversation,
  style,
}: {
  conversation: Conversation
  style?: React.CSSProperties
}) {
  const platformConfig = PLATFORM_CONFIG[conversation.platform as Platform]
  const [, toggleFavorite] = useAtom(toggleFavoriteAtom)

  const handleClick = () => {
    if (conversation.url) {
      browser.tabs.create({ url: conversation.url })
    }
  }

  return (
    <div
      className="group relative p-3 rounded-xl hover:bg-muted/60 cursor-pointer transition-all animate-slide-in"
      style={style}
      onClick={handleClick}
    >
      {/* Platform indicator line */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: platformConfig.color }}
      />

      <div className="flex items-start gap-3 pl-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm truncate group-hover:text-foreground transition-colors">
              {conversation.title}
            </h3>
            <ExternalLink className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>

          {conversation.preview && (
            <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed mb-2">
              {conversation.preview}
            </p>
          )}

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
            <span
              className="font-medium"
              style={{ color: platformConfig.color }}
            >
              {platformConfig.name}
            </span>
            <span className="opacity-40">·</span>
            <span>{formatDate(conversation.updatedAt)}</span>
            {conversation.messageCount > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span>{conversation.messageCount} msgs</span>
              </>
            )}
          </div>
        </div>

        <button
          className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0 cursor-pointer"
          onClick={(event) => {
            event.stopPropagation()
            toggleFavorite(conversation.id)
          }}
          title={conversation.isFavorite ? 'Unfavorite' : 'Favorite'}
        >
          <Star
            className={cn(
              'w-3.5 h-3.5 transition-colors',
              conversation.isFavorite
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/40 group-hover:text-muted-foreground'
            )}
          />
        </button>
      </div>
    </div>
  )
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Search className="w-6 h-6 text-muted-foreground/50" />
      </div>
      {searchQuery ? (
        <>
          <h3 className="font-heading font-medium mb-1">No results found</h3>
          <p className="text-sm text-muted-foreground/70">
            Try a different search term
          </p>
        </>
      ) : (
        <>
          <h3 className="font-heading font-medium mb-1">No conversations yet</h3>
          <p className="text-sm text-muted-foreground/70 max-w-[240px]">
            Visit Claude, ChatGPT, or Gemini to start syncing your conversations
          </p>
        </>
      )}
    </div>
  )
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}
