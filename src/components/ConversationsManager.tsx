import { useAtom } from 'jotai'
import { Calendar, CheckSquare, MessageSquare, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BatchActionBar,
  ConversationDetail,
  ConversationListItem,
  ConversationListSkeleton,
  PlatformFilterDropdown,
} from './conversations'
import type { Platform } from '@/types'
import {
  conversationsAtom,
  loadConversationsAtom,
  selectedConversationAtom,
  selectedMessagesAtom,
  loadConversationDetailAtom,
  paginationAtom,
  isLoadingConversationsAtom,
  favoritesConversationsAtom,
  loadFavoritesAtom,
  favoritesPaginationAtom,
  isLoadingFavoritesAtom,
  loadFavoriteDetailAtom,
  toggleFavoriteAtom,
  performSearchAtom,
  activeSearchQueryAtom,
  searchResultsAtom,
  selectedFilterTagsAtom,
  filtersAtom,
  setDateRangeAtom,
  hasDateFilterAtom,
  batchSelectedIdsAtom,
  isBatchModeAtom,
  batchSelectedCountAtom,
  toggleBatchSelectAtom,
  clearBatchSelectionAtom,
  selectAllVisibleAtom,
  currentPlatformFilterAtom,
  setPlatformFilterAtom,
  filteredConversationCountsAtom,
  filteredFavoriteCountsAtom,
} from '@/utils/atoms'
import { DateRangePicker } from './ui/DateRangePicker'
import { cn } from '@/utils/cn'
import { filterAndSortConversations } from '@/utils/filters'
import { exportConversations, downloadExport, exportBatchMarkdown } from '@/utils/sync/export'
import { downloadBlob } from '@/utils/sync/utils'
import { useClickOutside } from '@/hooks/useClickOutside'

export default function ConversationsManager({ mode = 'all' }: { mode?: 'all' | 'favorites' }) {
  const isFavorites = mode === 'favorites'
  const [conversations] = useAtom(isFavorites ? favoritesConversationsAtom : conversationsAtom)
  const [counts] = useAtom(
    isFavorites ? filteredFavoriteCountsAtom : filteredConversationCountsAtom
  )
  const [, loadConversations] = useAtom(isFavorites ? loadFavoritesAtom : loadConversationsAtom)
  const [selectedConversation] = useAtom(selectedConversationAtom)
  const [selectedMessages] = useAtom(selectedMessagesAtom)
  const [, loadDetail] = useAtom(isFavorites ? loadFavoriteDetailAtom : loadConversationDetailAtom)
  const [pagination] = useAtom(isFavorites ? favoritesPaginationAtom : paginationAtom)
  const [isLoading] = useAtom(isFavorites ? isLoadingFavoritesAtom : isLoadingConversationsAtom)
  const [, toggleFavorite] = useAtom(toggleFavoriteAtom)
  const [, searchConversations] = useAtom(performSearchAtom)
  const [activeSearchQuery] = useAtom(activeSearchQueryAtom)
  const [searchResults] = useAtom(searchResultsAtom)
  const [selectedFilterTags] = useAtom(selectedFilterTagsAtom)

  // Batch selection state
  const [batchSelectedIds] = useAtom(batchSelectedIdsAtom)
  const [isBatchMode] = useAtom(isBatchModeAtom)
  const [batchSelectedCount] = useAtom(batchSelectedCountAtom)
  const [, toggleBatchSelect] = useAtom(toggleBatchSelectAtom)
  const [, clearBatchSelection] = useAtom(clearBatchSelectionAtom)
  const [, selectAllVisible] = useAtom(selectAllVisibleAtom)

  // Date filter state
  const [filters] = useAtom(filtersAtom)
  const [, setDateRange] = useAtom(setDateRangeAtom)
  const [hasDateFilter] = useAtom(hasDateFilterAtom)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform] = useAtom(currentPlatformFilterAtom)
  const [, setPlatformFilter] = useAtom(setPlatformFilterAtom)
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false)
  const dateFilterRef = useRef<HTMLDivElement>(null)

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

  // Close dropdowns on Escape key
  useEffect(() => {
    if (!isDateFilterOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDateFilterOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isDateFilterOpen])

  // Close date filter dropdown when clicking outside
  useClickOutside(
    dateFilterRef,
    isDateFilterOpen,
    useCallback(() => setIsDateFilterOpen(false), [])
  )

  // Memoize array conversion to avoid repeated Set->Array conversions
  const selectedIdsArray = useMemo(() => Array.from(batchSelectedIds), [batchSelectedIds])

  // Batch export handlers
  const handleExportZip = useCallback(async () => {
    if (selectedIdsArray.length === 0) return
    const result = await exportConversations(selectedIdsArray)
    downloadExport(result)
    clearBatchSelection()
  }, [selectedIdsArray, clearBatchSelection])

  const handleExportMarkdown = useCallback(async () => {
    if (selectedIdsArray.length === 0) return
    const result = await exportBatchMarkdown(selectedIdsArray)
    downloadBlob(result.blob, result.filename)
    clearBatchSelection()
  }, [selectedIdsArray, clearBatchSelection])

  // Use shared filtering and sorting utilities
  // Note: platform filtering is now done at DB level, so we don't filter here
  const sortedConversations = useMemo(
    () =>
      filterAndSortConversations(
        conversations,
        {
          // Platform filtering is done at DB level, not here
          // Only apply local search filter in favorites mode (full search handled by atoms)
          searchQuery: isFavorites ? searchQuery : undefined,
          tags: selectedFilterTags,
          dateRange: filters.dateRange,
        },
        { byFavoriteTime: isFavorites }
      ),
    [conversations, isFavorites, searchQuery, selectedFilterTags, filters.dateRange]
  )

  // Check if all visible conversations are selected
  const isAllSelected =
    sortedConversations.length > 0 && sortedConversations.every((c) => batchSelectedIds.has(c.id))

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      clearBatchSelection()
    } else {
      const ids = sortedConversations.map((c) => c.id)
      selectAllVisible(ids)
    }
  }, [isAllSelected, clearBatchSelection, sortedConversations, selectAllVisible])

  const handlePlatformSelect = useCallback(
    (platform: Platform | 'all') => {
      setPlatformFilter(platform)
    },
    [setPlatformFilter]
  )

  const emptyLabel = isFavorites ? 'No favorites yet' : 'No conversations found'
  const pageTitle = isFavorites ? 'Favorites' : 'Conversations'

  return (
    <div className="h-full">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {isFavorites
            ? 'Your starred conversations for quick access'
            : 'Browse and manage all your AI conversations'}
        </p>
      </div>

      <div className="flex h-[calc(100vh-180px)] gap-6">
        {/* Left: Conversation List */}
        <div className="flex w-[380px] flex-shrink-0 flex-col">
          {/* Search and Filters */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <label htmlFor="manage-search" className="sr-only">
                Search conversations
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="manage-search"
                type="text"
                placeholder="Search conversations..."
                className="w-full rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-8 text-sm transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 transition-colors hover:bg-muted"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Platform Filter Dropdown */}
              <PlatformFilterDropdown
                selectedPlatform={selectedPlatform}
                counts={counts}
                onSelectPlatform={handlePlatformSelect}
              />

              {/* Date filter */}
              <div className="relative" ref={dateFilterRef}>
                <button
                  type="button"
                  className={cn(
                    'kbd-focus cursor-pointer rounded-xl border border-border p-2.5 transition-all hover:bg-muted/80',
                    hasDateFilter && 'border-primary bg-primary/10 text-primary'
                  )}
                  onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                  aria-label="Date filter"
                  aria-haspopup="dialog"
                  aria-expanded={isDateFilterOpen}
                >
                  <Calendar className="h-4 w-4" />
                </button>

                {isDateFilterOpen && (
                  <div
                    role="dialog"
                    aria-label="Date range filter"
                    className="absolute right-0 top-full z-10 mt-1 w-72 animate-scale-in rounded-xl border border-border bg-card p-4 shadow-lg"
                  >
                    <DateRangePicker
                      startDate={filters.dateRange.start}
                      endDate={filters.dateRange.end}
                      onChange={setDateRange}
                    />
                  </div>
                )}
              </div>

              {/* Batch select toggle */}
              <button
                type="button"
                className={cn(
                  'kbd-focus cursor-pointer rounded-xl border border-border p-2.5 transition-all hover:bg-muted/80',
                  isBatchMode && 'border-primary bg-primary/10 text-primary'
                )}
                onClick={() => {
                  if (isBatchMode) {
                    clearBatchSelection()
                  } else {
                    const firstConv = sortedConversations[0]
                    if (firstConv) {
                      toggleBatchSelect(firstConv.id)
                    }
                  }
                }}
                aria-label={isBatchMode ? 'Exit selection mode' : 'Enter selection mode'}
                aria-pressed={isBatchMode}
              >
                <CheckSquare className="h-4 w-4" />
              </button>

              <button
                type="button"
                className={cn(
                  'kbd-focus cursor-pointer rounded-xl border border-border p-2.5 transition-all hover:bg-muted/80',
                  isLoading && 'animate-pulse'
                )}
                onClick={() => loadConversations({ reset: true })}
                aria-label="Refresh conversations"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Batch operation bar */}
          {isBatchMode && (
            <BatchActionBar
              selectedCount={batchSelectedCount}
              isAllSelected={isAllSelected}
              onToggleSelectAll={handleToggleSelectAll}
              onClearSelection={clearBatchSelection}
              onExportZip={handleExportZip}
              onExportMarkdown={handleExportMarkdown}
            />
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-hidden rounded-2xl border border-border bg-card/30">
            <div
              className="scrollbar-thin h-full overflow-y-auto"
              role="list"
              aria-label="Conversation list"
            >
              {isLoading && conversations.length === 0 ? (
                <ConversationListSkeleton />
              ) : sortedConversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
                    <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{emptyLabel}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {sortedConversations.map((conv, index) => {
                    const matchInfo = searchResults.find((r) => r.conversation.id === conv.id)
                    const messageMatch = matchInfo?.matches.find((m) => m.type === 'message')
                    return (
                      <ConversationListItem
                        key={conv.id}
                        conversation={conv}
                        isSelected={selectedConversation?.id === conv.id}
                        onClick={() => {
                          if (isBatchMode) {
                            toggleBatchSelect(conv.id)
                          } else {
                            loadDetail(conv.id, messageMatch?.messageId)
                          }
                        }}
                        onToggleFavorite={() => toggleFavorite(conv.id)}
                        searchQuery={activeSearchQuery}
                        matchInfo={matchInfo}
                        style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
                        isBatchMode={isBatchMode}
                        isChecked={batchSelectedIds.has(conv.id)}
                        onToggleCheck={() => toggleBatchSelect(conv.id)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Load More */}
          {pagination.hasMore && (
            <div className="mt-3">
              <button
                type="button"
                className="kbd-focus w-full cursor-pointer rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                onClick={() => loadConversations()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
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
        <div className="min-w-0 flex-1">
          {selectedConversation ? (
            <ConversationDetail
              conversation={selectedConversation}
              messages={selectedMessages}
              searchQuery={activeSearchQuery}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 text-muted-foreground">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="mb-1 text-sm font-medium">Select a conversation</p>
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
