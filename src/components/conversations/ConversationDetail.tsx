import { useAtom } from 'jotai'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  MessageSquare,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { PLATFORM_CONFIG } from '@/types'
import { allTagsAtom, loadAllTagsAtom, scrollToMessageIdAtom, updateTagsAtom } from '@/utils/atoms'
import { cn } from '@/utils/cn'
import { exportConversationToJson, exportToMarkdown } from '@/utils/sync/export'
import { downloadBlob } from '@/utils/sync/utils'
import { TagManager } from '../TagManager'
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
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [allTags] = useAtom(allTagsAtom)
  const [, loadAllTags] = useAtom(loadAllTagsAtom)
  const [, updateTags] = useAtom(updateTagsAtom)

  // Load tags on mount
  useEffect(() => {
    loadAllTags()
  }, [loadAllTags])

  const handleTagsChange = useCallback(
    async (newTags: string[]) => {
      await updateTags({ conversationId: conversation.id, tags: newTags })
    },
    [conversation.id, updateTags]
  )

  // Scroll to target message when loaded
  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | undefined
    let highlightTimer: ReturnType<typeof setTimeout> | undefined

    if (scrollToMessageId && messages.length > 0 && messagesContainerRef.current) {
      const targetElement = messagesContainerRef.current.querySelector(
        `[data-message-id="${scrollToMessageId}"]`
      )
      if (targetElement) {
        // Small delay to ensure DOM is ready
        scrollTimer = setTimeout(() => {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Add highlight effect
          targetElement.classList.add(
            'ring-2',
            'ring-primary',
            'ring-offset-2',
            'ring-offset-background'
          )
          highlightTimer = setTimeout(() => {
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

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer)
      if (highlightTimer) clearTimeout(highlightTimer)
    }
  }, [scrollToMessageId, messages, setScrollToMessageId])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportMenu])

  const handleExportMarkdown = async () => {
    setShowExportMenu(false)
    const result = await exportToMarkdown(conversation.id)
    const blob = new Blob([result.content], { type: 'text/markdown' })
    downloadBlob(blob, result.filename)
  }

  const handleExportJson = async () => {
    setShowExportMenu(false)
    const result = await exportConversationToJson(conversation.id)
    const blob = new Blob([result.content], { type: 'application/json' })
    downloadBlob(blob, result.filename)
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
            <div className="mt-2">
              <TagManager
                tags={conversation.tags}
                onTagsChange={handleTagsChange}
                allTags={allTags}
              />
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              className="kbd-focus cursor-pointer rounded-xl p-2.5 transition-colors hover:bg-muted"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
              aria-label="Open in platform"
            >
              <ExternalLink className="h-4 w-4" />
            </button>

            {/* Export Dropdown */}
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                className={cn(
                  'kbd-focus flex cursor-pointer items-center gap-1 rounded-xl p-2.5 transition-colors hover:bg-muted',
                  showExportMenu && 'bg-muted'
                )}
                onClick={() => setShowExportMenu(!showExportMenu)}
                aria-label="Export options"
                aria-expanded={showExportMenu}
                aria-haspopup="true"
              >
                <Download className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-border bg-card p-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                    onClick={handleExportMarkdown}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Export as Markdown
                  </button>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                    onClick={handleExportJson}
                  >
                    <FileJson className="h-4 w-4 text-muted-foreground" />
                    Export as JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {needsSync && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Open the original conversation to sync full content</span>
            </div>
            <button
              type="button"
              className="cursor-pointer rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/30 dark:text-amber-200"
              onClick={() => conversation.url && browser.tabs.create({ url: conversation.url })}
            >
              Open
            </button>
          </div>
        )}

        {conversation.summary && <SummaryBlock summary={conversation.summary} />}
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

function SummaryBlock({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (el) {
      setClamped(el.scrollHeight > el.clientHeight)
    }
  }, [summary])

  return (
    <div className="mt-4 rounded-xl bg-muted/40 px-4 py-3">
      <div className="mb-1 text-xs font-medium text-foreground/50">Summary</div>
      <p
        ref={textRef}
        className={cn('text-sm leading-relaxed text-foreground/80', !expanded && 'line-clamp-2')}
      >
        {summary}
      </p>
      {clamped && (
        <button
          type="button"
          className="mt-1 flex cursor-pointer items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
