import { browser } from 'wxt/browser'
import { Settings } from 'lucide-react'
import ConversationsManager from '@/components/ConversationsManager'

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Chat Central</h1>
            <p className="text-sm text-muted-foreground">Manage conversations</p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            onClick={() => browser.runtime.openOptionsPage()}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <ConversationsManager />
      </main>
    </div>
  )
}
