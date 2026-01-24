import { useAtom } from 'jotai'
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Download,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ConversationDetail, ConversationListItem, ConversationListSkeleton } from './conversations'
import { PLATFORM_CONFIG, type Platform } from '@/types'
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
} from '@/utils/atoms'
import { DateRangePicker } from './ui/DateRangePicker'
import { cn } from '@/utils/cn'
import { filterAndSortConversations } from '@/utils/filters'
import { exportConversations, downloadExport, exportBatchMarkdown } from '@/utils/sync/export'
import { downloadBlob } from '@/utils/sync/utils'

export default function ConversationsManager({ mode = 'all' }: { mode?: 'all' | 'favorites' }) {
  const isFavorites = mode === 'favorites'
  const [conversations] = useAtom(isFavorites ? favoritesConversationsAtom : conversationsAtom)
  const [counts] = useAtom(isFavorites ? favoriteCountsAtom : conversationCountsAtom)
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
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const dateFilterRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false)
      }
    }

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isFilterOpen])

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false)
        setIsDateFilterOpen(false)
        setIsExportMenuOpen(false)
      }
    }

    if (isFilterOpen || isDateFilterOpen || isExportMenuOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isFilterOpen, isDateFilterOpen, isExportMenuOpen])

  // Close date filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setIsDateFilterOpen(false)
      }
    }

    if (isDateFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDateFilterOpen])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false)
      }
    }

    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExportMenuOpen])

  // Memoize array conversion to avoid repeated Set->Array conversions
  const selectedIdsArray = useMemo(() => Array.from(batchSelectedIds), [batchSelectedIds])

  // Batch export handlers
  const handleExportZip = async () => {
    if (selectedIdsArray.length === 0) return
    setIsExporting(true)
    try {
      const result = await exportConversations(selectedIdsArray)
      downloadExport(result)
      clearBatchSelection()
    } catch (error) {
      console.error('[ChatCentral] Failed to export ZIP:', error)
    } finally {
      setIsExporting(false)
      setIsExportMenuOpen(false)
    }
  }

  const handleExportMarkdown = async () => {
    if (selectedIdsArray.length === 0) return
    setIsExporting(true)
    try {
      const result = await exportBatchMarkdown(selectedIdsArray)
      downloadBlob(result.blob, result.filename)
      clearBatchSelection()
    } catch (error) {
      console.error('[ChatCentral] Failed to export Markdown:', error)
    } finally {
      setIsExporting(false)
      setIsExportMenuOpen(false)
    }
  }

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
  const filteredConversations = sortedConversations

  // Check if all visible conversations are selected
  const isAllSelected =
    sortedConversations.length > 0 && sortedConversations.every((c) => batchSelectedIds.has(c.id))

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      clearBatchSelection()
    } else {
      const ids = sortedConversations.map((c) => c.id)
      selectAllVisible(ids)
    }
  }

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
              <div className="relative flex-1" ref={filterRef}>
                <button
                  type="button"
                  className="kbd-focus flex w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm transition-colors hover:bg-muted/80"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={isFilterOpen}
                  aria-label="Filter by platform"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {selectedPlatform === 'all'
                        ? `All Platforms (${counts.total})`
                        : `${PLATFORM_CONFIG[selectedPlatform].name} (${counts[selectedPlatform]})`}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform duration-200',
                      isFilterOpen && 'rotate-180'
                    )}
                  />
                </button>

                {isFilterOpen && (
                  <div
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-10 mt-1 animate-scale-in overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedPlatform === 'all'}
                      className={cn(
                        'w-full cursor-pointer px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80',
                        selectedPlatform === 'all' && 'bg-primary/10 text-primary'
                      )}
                      onClick={() => {
                        setPlatformFilter('all')
                        setIsFilterOpen(false)
                      }}
                    >
                      All Platforms ({counts.total})
                    </button>
                    {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
                      <button
                        type="button"
                        key={platform}
                        role="option"
                        aria-selected={selectedPlatform === platform}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80',
                          selectedPlatform === platform && 'bg-primary/10 text-primary'
                        )}
                        onClick={() => {
                          setPlatformFilter(platform)
                          setIsFilterOpen(false)
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
                        />
                        {PLATFORM_CONFIG[platform].name} ({counts[platform]})
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
            <div className="mb-3 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
              <span className="text-sm font-medium">{batchSelectedCount} selected</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                  onClick={handleToggleSelectAll}
                >
                  {isAllSelected ? 'Deselect all' : 'Select all'}
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                  onClick={() => clearBatchSelection()}
                >
                  Clear selection
                </button>

                {/* Export dropdown */}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    type="button"
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50',
                      isExporting && 'opacity-50'
                    )}
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    disabled={batchSelectedCount === 0 || isExporting}
                    aria-haspopup="menu"
                    aria-expanded={isExportMenuOpen}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 transition-transform',
                        isExportMenuOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {isExportMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-10 mt-1 w-44 animate-scale-in overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full cursor-pointer px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
                        onClick={handleExportZip}
                      >
                        Export as ZIP (JSON)
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full cursor-pointer px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
                        onClick={handleExportMarkdown}
                      >
                        Export as Markdown
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
              ) : filteredConversations.length === 0 ? (
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
