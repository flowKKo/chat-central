import { useState } from 'react'
import { Trash2, Database, Settings, Info } from 'lucide-react'
import { PLATFORM_CONFIG, type Platform } from '@/types'
import { clearAllData, clearPlatformData } from '@/utils/db'
import { cn } from '@/utils/cn'
import ConversationsManager from '@/components/ConversationsManager'

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
        {activeTab === 'conversations' && <ConversationsManager />}
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
