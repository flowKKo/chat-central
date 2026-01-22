import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { useAtom } from 'jotai'
import { Search, Download, RefreshCw, ExternalLink, ChevronRight, Star } from 'lucide-react'
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

  useEffect(() => {
    loadConversations({ reset: true })
  }, [loadConversations])

  useEffect(() => {
    const timer = setTimeout(() => {
      // Only perform DB search for 'all' mode. Favorites usually are few enough for local filter,
      // but for consistency we could search DB too. However, favorites search isn't implemented in DB yet (specifically).
      // The current searchConversationsAndMessages searches ALL conversations.
      // If we are in 'favorites' mode, we might want to stick to local filtering or filter the DB results.
      // Given the requirement is generally "search", let's apply it to the main list.
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
    // If in favorites mode, we keep local search
    if (isFavorites && searchQuery) {
      const query = searchQuery.toLowerCase()
      // For favorites, we might miss content matches if we don't load full content. 
      // But for now, let's keep it simple for favorites (title/preview).
      return conv.title.toLowerCase().includes(query) || conv.preview.toLowerCase().includes(query)
    }
    // For normal mode, the list is already filtered by DB search (performSearchAtom)
    return true
  })

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const primaryA = isFavorites ? a.favoriteAt ?? 0 : a.updatedAt ?? 0
    const primaryB = isFavorites ? b.favoriteAt ?? 0 : b.updatedAt ?? 0
    if (primaryA !== primaryB) return primaryB - primaryA
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  })

  const emptyLabel = isFavorites ? 'No favorites yet' : 'No conversations found'

  return (
    <div className="flex gap-6">
      {/* Left: Conversation List */}
      <div className="w-[400px] flex-shrink-0">
        {/* Search and Filters */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <select
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value as Platform | 'all')}
            >
              <option value="all">All Platforms ({counts.total})</option>
              {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
                <option key={platform} value={platform}>
                  {PLATFORM_CONFIG[platform].name} ({counts[platform]})
                </option>
              ))}
            </select>

            <button
              className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
              onClick={() => loadConversations({ reset: true })}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="border border-border rounded-lg divide-y divide-border max-h-[600px] overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{emptyLabel}</div>
          ) : (
            sortedConversations.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedConversation?.id === conv.id}
                onClick={() => loadDetail(conv.id)}
                onToggleFavorite={() => toggleFavorite(conv.id)}
              />
            ))
          )}
        </div>

        {pagination.hasMore && (
          <div className="mt-3">
            <button
              className="w-full px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-60"
              onClick={() => loadConversations()}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {/* Right: Detail View */}
      <div className="flex-1">
        {selectedConversation ? (
          <ConversationDetail
            conversation={selectedConversation}
            messages={selectedMessages}
          />
        ) : (
          <div className="h-[600px] border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
            Select a conversation to view details
          </div>
        )}
      </div>
    </div>
  )
}

function ConversationListItem({
  conversation,
  isSelected,
  onClick,
  onToggleFavorite,
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onToggleFavorite: () => void
}) {
  const platformConfig = PLATFORM_CONFIG[conversation.platform]

  return (
    <div
      className={cn(
        'p-3 cursor-pointer transition-colors',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: platformConfig.color }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{conversation.title}</h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{platformConfig.name}</span>
            <span>·</span>
            <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <button
          className="p-1 rounded-md hover:bg-muted transition-colors"
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite()
          }}
          title={conversation.isFavorite ? 'Unfavorite' : 'Favorite'}
        >
          <Star
            className={cn(
              'w-4 h-4',
              conversation.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            )}
          />
        </button>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
    <div className="border border-border rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: platformConfig.color }}
              />
              <span className="text-sm text-muted-foreground">{platformConfig.name}</span>
            </div>
            <h2 className="text-lg font-semibold">{conversation.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {messages.length} messages · Updated{' '}
              {new Date(conversation.updatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="p-2 hover:bg-muted rounded-md transition-colors"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
              title="Open in platform"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              className="p-2 hover:bg-muted rounded-md transition-colors"
              onClick={handleExport}
              title="Export as Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        {needsSync && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span>未同步 / 仅摘要。去打开原对话同步。</span>
            <button
              className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
            >
              去打开原对话同步
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No synced messages yet.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'p-3 rounded-lg',
                message.role === 'user' ? 'bg-muted' : 'bg-card border border-border'
              )}
            >
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
