import { useTranslation } from 'react-i18next'
import { useAtomValue, useSetAtom } from 'jotai'
import { MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BatchActionBar,
  ConversationDetail,
  ConversationList,
  FilterToolbar,
  SearchBar,
} from './conversations'
import type { Platform } from '@/types'
import {
  selectedConversationAtom,
  selectedMessagesAtom,
  toggleFavoriteAtom,
  debouncedSearchAtom,
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
import { filterAndSortConversations } from '@/utils/filters'
import { exportConversations } from '@/utils/sync/export'
import { downloadBlob } from '@/utils/sync/utils'
import { useConversationSource } from '@/hooks/useConversationSource'

export default function ConversationsManager() {
  const { t } = useTranslation('conversations')
  const [searchParams, setSearchParams] = useSearchParams()
  const showFavoritesOnly = searchParams.get('favorites') === 'true'
  const setShowFavoritesOnly = useCallback(
    (value: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) {
            next.set('favorites', 'true')
          } else {
            next.delete('favorites')
          }
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )
  const isFavorites = showFavoritesOnly
  const { conversations, counts, loadConversations, loadDetail, pagination, isLoading } =
    useConversationSource(isFavorites)
  const selectedConversation = useAtomValue(selectedConversationAtom)
  const selectedMessages = useAtomValue(selectedMessagesAtom)
  const toggleFavorite = useSetAtom(toggleFavoriteAtom)
  const debouncedSearch = useSetAtom(debouncedSearchAtom)
  const activeSearchQuery = useAtomValue(activeSearchQueryAtom)
  const searchResults = useAtomValue(searchResultsAtom)
  const searchResultsMap = useMemo(
    () => new Map(searchResults.map((r) => [r.conversation.id, r])),
    [searchResults]
  )
  const selectedFilterTags = useAtomValue(selectedFilterTagsAtom)

  // Batch selection state
  const batchSelectedIds = useAtomValue(batchSelectedIdsAtom)
  const isBatchMode = useAtomValue(isBatchModeAtom)
  const batchSelectedCount = useAtomValue(batchSelectedCountAtom)
  const toggleBatchSelect = useSetAtom(toggleBatchSelectAtom)
  const clearBatchSelection = useSetAtom(clearBatchSelectionAtom)
  const selectAllVisible = useSetAtom(selectAllVisibleAtom)

  // Date filter state
  const filters = useAtomValue(filtersAtom)
  const setDateRange = useSetAtom(setDateRangeAtom)
  const hasDateFilter = useAtomValue(hasDateFilterAtom)

  const [searchQuery, setSearchQuery] = useState('')
  const selectedPlatform = useAtomValue(currentPlatformFilterAtom)
  const setPlatformFilter = useSetAtom(setPlatformFilterAtom)

  useEffect(() => {
    loadConversations({ reset: true })
  }, [loadConversations])

  // Open conversation detail from URL param (e.g. ?detail=claude_abc123)
  const detailId = searchParams.get('detail')
  useEffect(() => {
    if (detailId) {
      loadDetail(detailId, undefined)
      // Remove param from URL to avoid re-triggering on re-renders
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('detail')
          return next
        },
        { replace: true }
      )
    }
  }, [detailId, loadDetail, setSearchParams])

  useEffect(() => {
    if (!isFavorites) {
      debouncedSearch(searchQuery)
    }
  }, [searchQuery, debouncedSearch, isFavorites])

  // Memoize array conversion to avoid repeated Set->Array conversions
  const selectedIdsArray = useMemo(() => Array.from(batchSelectedIds), [batchSelectedIds])

  // Batch export handler
  const handleExport = useCallback(async () => {
    if (selectedIdsArray.length === 0) return
    const result = await exportConversations(selectedIdsArray)
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

  const handleToggleBatchMode = useCallback(() => {
    if (isBatchMode) {
      clearBatchSelection()
    } else {
      const firstConv = sortedConversations[0]
      if (firstConv) {
        toggleBatchSelect(firstConv.id)
      }
    }
  }, [isBatchMode, clearBatchSelection, sortedConversations, toggleBatchSelect])

  const handleItemClick = useCallback(
    (conversationId: string, messageId: string | undefined) => {
      loadDetail(conversationId, messageId)
    },
    [loadDetail]
  )

  const handleRefresh = useCallback(() => {
    loadConversations({ reset: true })
  }, [loadConversations])

  const handleLoadMore = useCallback(() => {
    loadConversations()
  }, [loadConversations])

  const emptyLabel = isFavorites ? t('noFavorites') : t('noConversationsFound')

  return (
    <div className="h-full">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex h-[calc(100vh-180px)] gap-6">
        {/* Left: Conversation List */}
        <div className="flex w-[380px] flex-shrink-0 flex-col">
          {/* Search and Filters */}
          <div className="mb-4 space-y-3">
            <SearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            <FilterToolbar
              selectedPlatform={selectedPlatform}
              counts={counts}
              onSelectPlatform={handlePlatformSelect}
              filters={filters}
              onSetDateRange={setDateRange}
              hasDateFilter={hasDateFilter}
              showFavoritesOnly={showFavoritesOnly}
              onToggleFavorites={setShowFavoritesOnly}
              isBatchMode={isBatchMode}
              onToggleBatchMode={handleToggleBatchMode}
              isLoading={isLoading}
              onRefresh={handleRefresh}
            />
          </div>

          {/* Batch operation bar */}
          {isBatchMode && (
            <BatchActionBar
              selectedCount={batchSelectedCount}
              isAllSelected={isAllSelected}
              onToggleSelectAll={handleToggleSelectAll}
              onClearSelection={clearBatchSelection}
              onExport={handleExport}
            />
          )}

          <ConversationList
            conversations={sortedConversations}
            isLoading={isLoading}
            hasLoadedConversations={conversations.length > 0}
            emptyLabel={emptyLabel}
            selectedConversationId={selectedConversation?.id}
            searchQuery={activeSearchQuery}
            searchResultsMap={searchResultsMap}
            isBatchMode={isBatchMode}
            batchSelectedIds={batchSelectedIds}
            onItemClick={handleItemClick}
            onToggleFavorite={toggleFavorite}
            onToggleBatchSelect={toggleBatchSelect}
            hasMore={pagination.hasMore}
            onLoadMore={handleLoadMore}
          />
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
              <p className="mb-1 text-sm font-medium">{t('selectConversation')}</p>
              <p className="text-xs text-muted-foreground/60">{t('selectConversationHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
