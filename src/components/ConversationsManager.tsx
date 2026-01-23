import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { useAtom } from 'jotai'
import {
  Search,
  Download,
  RefreshCw,
  ExternalLink,
  Star,
  Filter,
  MessageSquare,
  User,
  Bot,
  AlertCircle,
  ChevronDown,
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
} from '@/utils/atoms'
import { PLATFORM_CONFIG, type Platform, type Conversation, type Message } from '@/types'
import { cn } from '@/utils/cn'

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

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)

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

  const filteredConversations = conversations.filter((conv) => {
    if (selectedPlatform !== 'all' && conv.platform !== selectedPlatform) {
      return false
    }
    if (isFavorites && searchQuery) {
      const query = searchQuery.toLowerCase()
      return conv.title.toLowerCase().includes(query) || conv.preview.toLowerCase().includes(query)
    }
    return true
  })

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const primaryA = isFavorites ? a.favoriteAt ?? 0 : a.updatedAt ?? 0
    const primaryB = isFavorites ? b.favoriteAt ?? 0 : b.updatedAt ?? 0
    if (primaryA !== primaryB) return primaryB - primaryA
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  })

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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Platform Filter Dropdown */}
              <div className="relative flex-1">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm hover:bg-muted/80 transition-colors cursor-pointer"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
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
                      'w-4 h-4 text-muted-foreground transition-transform',
                      isFilterOpen && 'rotate-180'
                    )}
                  />
                </button>

                {isFilterOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden animate-scale-in">
                    <button
                      className={cn(
                        'w-full px-3 py-2 text-sm text-left hover:bg-muted/80 transition-colors cursor-pointer',
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
                        className={cn(
                          'w-full px-3 py-2 text-sm text-left hover:bg-muted/80 transition-colors cursor-pointer flex items-center gap-2',
                          selectedPlatform === platform && 'bg-primary/10 text-primary'
                        )}
                        onClick={() => {
                          setSelectedPlatform(platform)
                          setIsFilterOpen(false)
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
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
                  'p-2 border border-border rounded-xl hover:bg-muted/80 transition-all cursor-pointer',
                  isLoading && 'animate-pulse'
                )}
                onClick={() => loadConversations({ reset: true })}
                title="Refresh"
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 border border-border rounded-2xl overflow-hidden bg-card/30">
            <div className="h-full overflow-y-auto scrollbar-thin">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <MessageSquare className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{emptyLabel}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {sortedConversations.map((conv, index) => (
                    <ConversationListItem
                      key={conv.id}
                      conversation={conv}
                      isSelected={selectedConversation?.id === conv.id}
                      onClick={() => loadDetail(conv.id)}
                      onToggleFavorite={() => toggleFavorite(conv.id)}
                      style={{ animationDelay: `${index * 20}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Load More */}
          {pagination.hasMore && (
            <div className="mt-3">
              <button
                className="w-full px-4 py-2.5 text-sm font-medium text-muted-foreground border border-dashed border-border rounded-xl hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
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

function ConversationListItem({
  conversation,
  isSelected,
  onClick,
  onToggleFavorite,
  style,
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onToggleFavorite: () => void
  style?: React.CSSProperties
}) {
  const platformConfig = PLATFORM_CONFIG[conversation.platform]

  return (
    <div
      className={cn(
        'group relative p-3.5 cursor-pointer transition-all animate-fade-in',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
      style={style}
      onClick={onClick}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-primary" />
      )}

      <div className="flex items-center gap-3">
        {/* Platform indicator */}
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
            isSelected ? 'scale-105' : 'group-hover:scale-105'
          )}
          style={{ backgroundColor: `${platformConfig.color}20` }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: platformConfig.color }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{conversation.title}</h3>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span style={{ color: platformConfig.color }}>{platformConfig.name}</span>
            <span className="opacity-40">·</span>
            <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        <button
          className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0 cursor-pointer opacity-0 group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite()
          }}
          title={conversation.isFavorite ? 'Unfavorite' : 'Favorite'}
        >
          <Star
            className={cn(
              'w-4 h-4 transition-colors',
              conversation.isFavorite
                ? 'fill-amber-400 text-amber-400 opacity-100'
                : 'text-muted-foreground'
            )}
          />
        </button>
      </div>
    </div>
  )
}

function ConversationDetail({
  conversation,
  messages,
}: {
  conversation: Conversation
  messages: Message[]
}) {
  const platformConfig = PLATFORM_CONFIG[conversation.platform]
  const needsSync = conversation.detailStatus !== 'full' || messages.length === 0

  const handleExport = () => {
    const content = messages
      .map((m) => `## ${m.role === 'user' ? 'You' : 'Assistant'}\n\n${m.content}`)
      .join('\n\n---\n\n')

    const blob = new Blob([`# ${conversation.title}\n\n${content}`], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conversation.title.slice(0, 50)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col border border-border rounded-2xl overflow-hidden bg-card/30">
      {/* Header */}
      <div className="p-5 border-b border-border/50 bg-card/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${platformConfig.color}20` }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: platformConfig.color }}
                />
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: platformConfig.color }}
              >
                {platformConfig.name}
              </span>
            </div>
            <h2 className="text-lg font-heading font-semibold truncate">{conversation.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {messages.length} messages · Updated {new Date(conversation.updatedAt).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="p-2.5 hover:bg-muted rounded-xl transition-colors cursor-pointer"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
              title="Open in platform"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              className="p-2.5 hover:bg-muted rounded-xl transition-colors cursor-pointer"
              onClick={handleExport}
              title="Export as Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {needsSync && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-amber-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Open the original conversation to sync full content</span>
            </div>
            <button
              className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 rounded-lg transition-colors cursor-pointer text-amber-200"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
            >
              Open
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No synced messages yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                platformColor={platformConfig.color}
                style={{ animationDelay: `${index * 30}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  platformColor,
  style,
}: {
  message: Message
  platformColor: string
  style?: React.CSSProperties
}) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn('flex gap-3 animate-slide-in', isUser && 'flex-row-reverse')}
      style={style}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-primary/20' : 'bg-muted'
        )}
        style={!isUser ? { backgroundColor: `${platformColor}15` } : undefined}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <Bot className="w-4 h-4" style={{ color: platformColor }} />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'flex-1 max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary/15 text-foreground ml-auto'
            : 'bg-muted/50 border border-border/50'
        )}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? 'You' : 'Assistant'}
          </span>
        </div>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
      </div>
    </div>
  )
}
