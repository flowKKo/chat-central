import { useEffect, useRef } from 'react'
import { browser } from 'wxt/browser'
import { useAtom } from 'jotai'
import { Download, ExternalLink, MessageSquare, AlertCircle, Clock } from 'lucide-react'
import type { Conversation, Message } from '@/types'
import { PLATFORM_CONFIG } from '@/types'
import { scrollToMessageIdAtom } from '@/utils/atoms'
import { MessageBubble } from './MessageBubble'

interface ConversationDetailProps {
  conversation: Conversation
  messages: Message[]
  searchQuery?: string
}

export function ConversationDetail({
  conversation,
  messages,
  searchQuery,
}: ConversationDetailProps) {
  const platformConfig = PLATFORM_CONFIG[conversation.platform]
  const needsSync = conversation.detailStatus !== 'full' || messages.length === 0
  const [scrollToMessageId, setScrollToMessageId] = useAtom(scrollToMessageIdAtom)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Scroll to target message when loaded
  useEffect(() => {
    if (scrollToMessageId && messages.length > 0 && messagesContainerRef.current) {
      const targetElement = messagesContainerRef.current.querySelector(
        `[data-message-id="${scrollToMessageId}"]`
      )
      if (targetElement) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Add highlight effect
          targetElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background')
          setTimeout(() => {
            targetElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background')
          }, 2000)
        }, 100)
        // Clear the scroll target
        setScrollToMessageId(null)
      }
    }
  }, [scrollToMessageId, messages, setScrollToMessageId])

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
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${platformConfig.color}15` }}
              >
                <span
                  className="w-3 h-3 rounded-full"
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span className="tabular-nums">{messages.length} messages</span>
              <span className="opacity-40" aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="tabular-nums">{new Date(conversation.updatedAt).toLocaleString()}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="p-2.5 hover:bg-muted rounded-xl transition-colors cursor-pointer kbd-focus"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
              aria-label="Open in platform"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              className="p-2.5 hover:bg-muted rounded-xl transition-colors cursor-pointer kbd-focus"
              onClick={handleExport}
              aria-label="Export as Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {needsSync && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Open the original conversation to sync full content</span>
            </div>
            <button
              className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 rounded-lg transition-colors cursor-pointer text-amber-700 dark:text-amber-200"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
            >
              Open
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto scrollbar-thin p-5">
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
                searchQuery={searchQuery}
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
