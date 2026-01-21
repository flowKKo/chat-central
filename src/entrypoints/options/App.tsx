import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { useAtom } from 'jotai'
import {
  Search,
  Download,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Database,
  Settings,
  Info,
} from 'lucide-react'
import {
  conversationsAtom,
  loadConversationsAtom,
  conversationCountsAtom,
  selectedConversationAtom,
  selectedMessagesAtom,
  loadConversationDetailAtom,
  clearSelectionAtom,
  paginationAtom,
  isLoadingConversationsAtom,
} from '@/utils/atoms'
import { PLATFORM_CONFIG, type Platform, type Conversation } from '@/types'
import { clearAllData, clearPlatformData } from '@/utils/db'
import { cn } from '@/utils/cn'

type Tab = 'conversations' | 'settings' | 'about'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('conversations')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Chat Central</h1>
            <nav className="flex gap-1">
              <TabButton
                icon={<Database className="w-4 h-4" />}
                label="Conversations"
                isActive={activeTab === 'conversations'}
                onClick={() => setActiveTab('conversations')}
              />
              <TabButton
                icon={<Settings className="w-4 h-4" />}
                label="Settings"
                isActive={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
              />
              <TabButton
                icon={<Info className="w-4 h-4" />}
                label="About"
                isActive={activeTab === 'about'}
                onClick={() => setActiveTab('about')}
              />
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'conversations' && <ConversationsTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'about' && <AboutTab />}
      </main>
    </div>
  )
}

function TabButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
        isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  )
}

function ConversationsTab() {
  const [conversations] = useAtom(conversationsAtom)
  const [counts] = useAtom(conversationCountsAtom)
  const [, loadConversations] = useAtom(loadConversationsAtom)
  const [selectedConversation] = useAtom(selectedConversationAtom)
  const [selectedMessages] = useAtom(selectedMessagesAtom)
  const [, loadDetail] = useAtom(loadConversationDetailAtom)
  const [, clearSelection] = useAtom(clearSelectionAtom)
  const [pagination] = useAtom(paginationAtom)
  const [isLoading] = useAtom(isLoadingConversationsAtom)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all')

  useEffect(() => {
    loadConversations({ reset: true })
  }, [loadConversations])

  const filteredConversations = conversations.filter((conv) => {
    if (selectedPlatform !== 'all' && conv.platform !== selectedPlatform) {
      return false
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return conv.title.toLowerCase().includes(query) || conv.preview.toLowerCase().includes(query)
    }
    return true
  })

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
            <div className="p-8 text-center text-muted-foreground">No conversations found</div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedConversation?.id === conv.id}
                onClick={() => loadDetail(conv.id)}
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
            onClose={clearSelection}
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
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
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
  messages: any[]
  onClose: () => void
}) {
  const platformConfig = PLATFORM_CONFIG[conversation.platform]

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
      </div>

      {/* Messages */}
      <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('p-3 rounded-lg', message.role === 'user' ? 'bg-muted' : 'bg-card border border-border')}
          >
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsTab() {
  const [isClearing, setIsClearing] = useState(false)

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all synced conversations? This cannot be undone.')) {
      return
    }
    setIsClearing(true)
    try {
      await clearAllData()
      window.location.reload()
    } finally {
      setIsClearing(false)
    }
  }

  const handleClearPlatform = async (platform: Platform) => {
    if (!confirm(`Delete all ${PLATFORM_CONFIG[platform].name} conversations?`)) {
      return
    }
    setIsClearing(true)
    try {
      await clearPlatformData(platform)
      window.location.reload()
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>
        <div className="space-y-3">
          {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
            <div
              key={platform}
              className="flex items-center justify-between p-4 border border-border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
                />
                <span className="font-medium">{PLATFORM_CONFIG[platform].name}</span>
              </div>
              <button
                className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                onClick={() => handleClearPlatform(platform)}
                disabled={isClearing}
              >
                Clear Data
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Danger Zone</h2>
        <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Delete All Data</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete all synced conversations from all platforms
              </p>
            </div>
            <button
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors flex items-center gap-2"
              onClick={handleClearAll}
              disabled={isClearing}
            >
              <Trash2 className="w-4 h-4" />
              {isClearing ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function AboutTab() {
  return (
    <div className="max-w-2xl">
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold mb-4">Chat Central</h2>
        <p className="text-lg text-muted-foreground mb-8">
          Unified AI conversation manager for Claude, ChatGPT, and Gemini
        </p>

        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="p-6 border border-border rounded-lg">
            <div className="text-3xl mb-2">🔄</div>
            <h3 className="font-semibold mb-1">Auto Sync</h3>
            <p className="text-sm text-muted-foreground">
              Automatically track conversations as you chat
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg">
            <div className="text-3xl mb-2">🔍</div>
            <h3 className="font-semibold mb-1">Smart Search</h3>
            <p className="text-sm text-muted-foreground">
              Find any conversation across all platforms
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg">
            <div className="text-3xl mb-2">💾</div>
            <h3 className="font-semibold mb-1">Local Storage</h3>
            <p className="text-sm text-muted-foreground">Your data stays on your device</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Version 0.1.0</p>
      </div>
    </div>
  )
}
