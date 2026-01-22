import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { useAtom } from 'jotai'
import { Search, Settings, ExternalLink, Database } from 'lucide-react'
import {
  conversationsAtom,
  loadConversationsAtom,
  conversationCountsAtom,
  paginationAtom,
  isLoadingConversationsAtom,
} from '@/utils/atoms'
import { PLATFORM_CONFIG, type Platform, type Conversation } from '@/types'
import { cn } from '@/utils/cn'

export default function App() {
  const [conversations] = useAtom(conversationsAtom)
  const [counts] = useAtom(conversationCountsAtom)
  const [, loadConversations] = useAtom(loadConversationsAtom)
  const [pagination] = useAtom(paginationAtom)
  const [isLoading] = useAtom(isLoadingConversationsAtom)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all')

  useEffect(() => {
    loadConversations({ reset: true })
  }, [loadConversations])

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (selectedPlatform !== 'all' && conv.platform !== selectedPlatform) {
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

  return (
    <div className="w-[400px] min-h-[500px] max-h-[600px] flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Chat Central</h1>
          <button
            className="p-2 hover:bg-muted rounded-md transition-colors"
            onClick={() => browser.runtime.openOptionsPage()}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2 bg-muted rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      {/* Platform Tabs */}
      <div className="flex gap-1 p-2 border-b border-border">
        <PlatformTab
          label="All"
          count={counts.total}
          isActive={selectedPlatform === 'all'}
          onClick={() => setSelectedPlatform('all')}
        />
        {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
          <PlatformTab
            key={platform}
            label={PLATFORM_CONFIG[platform].name}
            count={counts[platform]}
            color={PLATFORM_CONFIG[platform].color}
            isActive={selectedPlatform === platform}
            onClick={() => setSelectedPlatform(platform)}
          />
        ))}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : (
          <div className="divide-y divide-border">
            {filteredConversations.map((conv) => (
              <ConversationItem key={conv.id} conversation={conv} />
            ))}
            {pagination.hasMore && (
              <div className="p-3">
                <button
                  className="w-full px-3 py-2 text-xs border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-60"
                  onClick={() => loadConversations()}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <footer className="p-3 border-t border-border bg-muted/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            <span>{counts.total} conversations synced</span>
          </div>
          <button
            className="text-primary hover:underline"
            onClick={() => browser.tabs.create({ url: browser.runtime.getURL('manage.html') })}
          >
            Manage
          </button>
        </div>
      </footer>
    </div>
  )
}

function PlatformTab({
  label,
  count,
  color,
  isActive,
  onClick,
}: {
  label: string
  count: number
  color?: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
        isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
      style={isActive && color ? { backgroundColor: color } : undefined}
      onClick={onClick}
    >
      {label} ({count})
    </button>
  )
}

function ConversationItem({ conversation }: { conversation: Conversation }) {
  const platformConfig = PLATFORM_CONFIG[conversation.platform as Platform]

  const handleClick = () => {
    if (conversation.url) {
      browser.tabs.create({ url: conversation.url })
    }
  }

  return (
    <div
      className="p-3 hover:bg-muted/50 cursor-pointer transition-colors group"
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
          style={{ backgroundColor: platformConfig.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{conversation.title}</h3>
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
          {conversation.preview && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{conversation.preview}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{platformConfig.name}</span>
            <span>·</span>
            <span>{formatDate(conversation.updatedAt)}</span>
            {conversation.messageCount > 0 && (
              <>
                <span>·</span>
                <span>{conversation.messageCount} messages</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Search className="w-6 h-6 text-muted-foreground" />
      </div>
      {searchQuery ? (
        <>
          <h3 className="font-medium mb-1">No results found</h3>
          <p className="text-sm text-muted-foreground">
            Try a different search term
          </p>
        </>
      ) : (
        <>
          <h3 className="font-medium mb-1">No conversations yet</h3>
          <p className="text-sm text-muted-foreground">
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
