import { useAtom } from 'jotai'
import { Github, LayoutDashboard, Search, Settings, Sparkles, Star, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { browser } from 'wxt/browser'
import { I18nProvider } from '@/components/providers/I18nProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { Tooltip } from '@/components/ui/Tooltip'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import type { Platform } from '@/types'
import { PLATFORM_CONFIG } from '@/types'
import {
  activeSearchQueryAtom,
  conversationCountsAtom,
  conversationsAtom,
  currentPlatformFilterAtom,
  isLoadingConversationsAtom,
  loadConversationsAtom,
  paginationAtom,
  performSearchAtom,
  searchResultsAtom,
  setPlatformFilterAtom,
} from '@/utils/atoms'
import { ConversationItem, EmptyState, LoadingSkeleton, PlatformTab } from './components'

export default function App() {
  const { t } = useTranslation('popup')
  const [conversations] = useAtom(conversationsAtom)
  const [counts] = useAtom(conversationCountsAtom)
  const [, loadConversations] = useAtom(loadConversationsAtom)
  const [pagination] = useAtom(paginationAtom)
  const [isLoading] = useAtom(isLoadingConversationsAtom)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform] = useAtom(currentPlatformFilterAtom)
  const [, setPlatformFilter] = useAtom(setPlatformFilterAtom)
  const [, performSearch] = useAtom(performSearchAtom)
  const [activeSearchQuery] = useAtom(activeSearchQueryAtom)
  const [searchResults] = useAtom(searchResultsAtom)
  const searchResultsMap = useMemo(
    () => new Map(searchResults.map((r) => [r.conversation.id, r])),
    [searchResults]
  )
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadConversations({ reset: true })
  }, [loadConversations])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, performSearch])

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    searchInputRef.current?.focus()
  }, [])

  const handleLoadMore = useCallback(() => {
    loadConversations()
  }, [loadConversations])
  const { sentinelRef, containerRef } = useInfiniteScroll(handleLoadMore, {
    hasMore: pagination.hasMore,
    isLoading,
  })

  return (
    <ThemeProvider>
      <I18nProvider>
        <div className="flex max-h-[600px] min-h-[520px] w-[380px] flex-col bg-background text-foreground">
          {/* Header */}
          <header className="relative bg-card px-3 pb-3 pt-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="font-heading text-base font-semibold text-foreground">
                    {t('common:appName')}
                  </h1>
                  <p className="text-[11px] text-muted-foreground">{t('common:appTagline')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip label={t('common:github')}>
                  <button
                    type="button"
                    className="kbd-focus cursor-pointer rounded-lg p-2 transition-colors hover:bg-muted"
                    onClick={() =>
                      browser.tabs.create({ url: 'https://github.com/flowKKo/chat-central' })
                    }
                    aria-label={t('viewOnGithub')}
                  >
                    <Github className="h-4 w-4 text-muted-foreground" />
                  </button>
                </Tooltip>
                <Tooltip label={t('common:favorites')}>
                  <button
                    type="button"
                    className="kbd-focus cursor-pointer rounded-lg p-2 transition-colors hover:bg-muted"
                    onClick={() =>
                      browser.tabs.create({
                        url: browser.runtime.getURL('/manage.html#/conversations?favorites=true'),
                      })
                    }
                    aria-label={t('viewFavorites')}
                  >
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </button>
                </Tooltip>
                <Tooltip label={t('common:settings')}>
                  <button
                    type="button"
                    className="kbd-focus cursor-pointer rounded-lg p-2 transition-colors hover:bg-muted"
                    onClick={() =>
                      browser.tabs.create({ url: browser.runtime.getURL('/manage.html#/settings') })
                    }
                    aria-label={t('openSettings')}
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <label htmlFor="search-input" className="sr-only">
                {t('searchConversations')}
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                id="search-input"
                type="text"
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-xl border border-border bg-muted py-2.5 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 transition-colors hover:bg-accent"
                  onClick={clearSearch}
                  aria-label={t('clearSearch')}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </header>

          {/* Platform Filter Tabs */}
          <div
            className="border-b border-border bg-card px-3 py-2"
            role="tablist"
            aria-label={t('conversations:filterByPlatform')}
          >
            <div className="flex items-center gap-1">
              <PlatformTab
                label="All"
                count={counts.total}
                isActive={selectedPlatform === 'all'}
                onClick={() => setPlatformFilter('all')}
              />
              {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
                <PlatformTab
                  key={platform}
                  platform={platform}
                  count={counts[platform]}
                  isActive={selectedPlatform === platform}
                  onClick={() => setPlatformFilter(platform)}
                />
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div
            className="scrollbar-thin flex-1 overflow-y-auto bg-background"
            ref={containerRef}
            role="list"
            aria-label={t('common:conversations')}
          >
            {isLoading && conversations.length === 0 ? (
              <LoadingSkeleton />
            ) : conversations.length === 0 ? (
              <EmptyState searchQuery={searchQuery} onClearSearch={clearSearch} />
            ) : (
              <div className="space-y-1 px-3 py-2">
                {conversations.map((conv) => {
                  const matchInfo = searchResultsMap.get(conv.id)
                  return (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      searchQuery={activeSearchQuery}
                      matchInfo={matchInfo}
                    />
                  )
                })}
                {pagination.hasMore && (
                  <div className="flex justify-center pb-1 pt-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                  </div>
                )}
              </div>
            )}
            <div ref={sentinelRef} aria-hidden="true" />
          </div>

          {/* Footer */}
          <footer className="border-t border-border bg-card px-3 py-2.5">
            <div className="relative flex items-center justify-between">
              <button
                type="button"
                className="kbd-focus flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() =>
                  browser.tabs.create({
                    url: browser.runtime.getURL('/manage.html#/conversations'),
                  })
                }
                aria-label={t('openDashboard')}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                {t('common:dashboard')}
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 text-xs tabular-nums text-muted-foreground">
                {`v${browser.runtime.getManifest().version}`}
              </span>
            </div>
          </footer>
        </div>
      </I18nProvider>
    </ThemeProvider>
  )
}
