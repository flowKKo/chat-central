import { Search } from 'lucide-react'
import { browser } from 'wxt/browser'
import type { Platform } from '@/types'
import { PLATFORM_CONFIG } from '@/types'

interface EmptyStateProps {
  searchQuery: string
  onClearSearch: () => void
}

export function EmptyState({ searchQuery, onClearSearch }: EmptyStateProps) {
  return (
    <div className="flex h-full animate-fade-in flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      {searchQuery ? (
        <>
          <h3 className="mb-1 font-heading font-medium text-foreground">No results found</h3>
          <p className="mb-4 text-sm text-muted-foreground">Try a different search term</p>
          <button
            type="button"
            className="kbd-focus cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            onClick={onClearSearch}
          >
            Clear search
          </button>
        </>
      ) : (
        <>
          <h3 className="mb-1 font-heading font-medium text-foreground">No conversations yet</h3>
          <p className="mb-4 max-w-[240px] text-sm text-muted-foreground">
            Visit Claude, ChatGPT, or Gemini to start syncing your conversations
          </p>
          <div className="flex items-center gap-2">
            {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
              <button
                type="button"
                key={platform}
                className="kbd-focus flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                style={{ color: PLATFORM_CONFIG[platform].color }}
                onClick={() => browser.tabs.create({ url: PLATFORM_CONFIG[platform].baseUrl })}
                aria-label={`Open ${PLATFORM_CONFIG[platform].name}`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: PLATFORM_CONFIG[platform].color }}
                />
                {PLATFORM_CONFIG[platform].name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
