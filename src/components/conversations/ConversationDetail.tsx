import { useAtom } from 'jotai'
import { Download, ExternalLink, MessageSquare, AlertCircle, Clock } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { browser } from 'wxt/browser'
import { PLATFORM_CONFIG } from '@/types'
import { scrollToMessageIdAtom } from '@/utils/atoms'
import { MessageBubble } from './MessageBubble'
import type { Conversation, Message } from '@/types'

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
          targetElement.classList.add(
            'ring-2',
            'ring-primary',
            'ring-offset-2',
            'ring-offset-background'
          )
          setTimeout(() => {
            targetElement.classList.remove(
              'ring-2',
              'ring-primary',
              'ring-offset-2',
              'ring-offset-background'
            )
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
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/30">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${platformConfig.color}15` }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: platformConfig.color }}
                />
              </div>
              <span className="text-sm font-medium" style={{ color: platformConfig.color }}>
                {platformConfig.name}
              </span>
            </div>
            <h2 className="truncate font-heading text-lg font-semibold">{conversation.title}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">{messages.length} messages</span>
              <span className="opacity-40" aria-hidden="true">
                ·
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="tabular-nums">
                  {new Date(conversation.updatedAt).toLocaleString()}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              className="kbd-focus cursor-pointer rounded-xl p-2.5 transition-colors hover:bg-muted"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
              aria-label="Open in platform"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              className="kbd-focus cursor-pointer rounded-xl p-2.5 transition-colors hover:bg-muted"
              onClick={handleExport}
              aria-label="Export as Markdown"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {needsSync && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Open the original conversation to sync full content</span>
            </div>
            <button
              className="cursor-pointer rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/30 dark:text-amber-200"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
            >
              Open
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="scrollbar-thin flex-1 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
              <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
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
