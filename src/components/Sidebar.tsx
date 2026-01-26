import type { LucideIcon } from 'lucide-react'
import { useAtom } from 'jotai'
import { ChevronDown, Info, MessageSquare, Settings, Sparkles, Star, Tag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  allTagsAtom,
  clearTagFiltersAtom,
  conversationCountsAtom,
  favoriteCountsAtom,
  loadAllTagsAtom,
  selectedFilterTagsAtom,
  toggleTagFilterAtom,
} from '@/utils/atoms'
import { cn } from '@/utils/cn'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  badgeAtom?: 'conversations' | 'favorites'
}

const navItems: NavItem[] = [
  {
    path: '/conversations',
    label: 'Conversations',
    icon: MessageSquare,
    badgeAtom: 'conversations',
  },
  { path: '/favorites', label: 'Favorites', icon: Star, badgeAtom: 'favorites' },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/about', label: 'About', icon: Info },
]

export function Sidebar() {
  const [conversationCounts] = useAtom(conversationCountsAtom)
  const [favoriteCounts] = useAtom(favoriteCountsAtom)
  const [allTags] = useAtom(allTagsAtom)
  const [selectedTags] = useAtom(selectedFilterTagsAtom)
  const [, loadAllTags] = useAtom(loadAllTagsAtom)
  const [, toggleTagFilter] = useAtom(toggleTagFilterAtom)
  const [, clearTagFilters] = useAtom(clearTagFiltersAtom)
  const [isTagsExpanded, setIsTagsExpanded] = useState(true)
  const location = useLocation()

  // Load tags on mount
  useEffect(() => {
    loadAllTags()
  }, [loadAllTags])

  const getBadgeCount = (badgeAtom?: 'conversations' | 'favorites') => {
    if (badgeAtom === 'conversations') return conversationCounts.total
    if (badgeAtom === 'favorites') return favoriteCounts.total
    return undefined
  }

  // Only show tags section on conversations page
  const showTagsSection = location.pathname === '/conversations' || location.pathname === '/'

  return (
    <aside className="gradient-mesh flex h-screen w-60 flex-col border-r border-border bg-card/50">
      {/* Logo */}
      <div className="border-b border-border/50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400 shadow-glow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold tracking-tight">Chat Central</h1>
            <p className="text-xs text-muted-foreground">AI Conversation Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-hidden p-3" aria-label="Main navigation">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const badgeCount = getBadgeCount(item.badgeAtom)
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'kbd-focus group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                    )}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isActive ? 'scale-110' : 'group-hover:scale-105',
                        )}
                      />
                      <span>{item.label}</span>
                      {badgeCount !== undefined && badgeCount > 0 && (
                        <span
                          className={cn(
                            'ml-auto min-w-[1.5rem] rounded-full px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums',
                            isActive
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {badgeCount > 999 ? '999+' : badgeCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>

        {/* Tags Section */}
        {showTagsSection && allTags.length > 0 && (
          <div className="mt-4 border-t border-border/50 pt-4">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setIsTagsExpanded(!isTagsExpanded)}
              aria-expanded={isTagsExpanded}
            >
              <span className="flex items-center gap-2">
                <Tag className="h-3 w-3" />
                Tags
                {selectedTags.length > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {selectedTags.length}
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  isTagsExpanded && 'rotate-180',
                )}
              />
            </button>

            {isTagsExpanded && (
              <div className="mt-2 space-y-1">
                {selectedTags.length > 0 && (
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => clearTagFilters()}
                  >
                    <X className="h-3 w-3" />
                    Clear filters
                  </button>
                )}
                <div className="scrollbar-thin max-h-40 space-y-0.5 overflow-y-auto">
                  {allTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag)
                    return (
                      <button
                        type="button"
                        key={tag}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        onClick={() => toggleTagFilter(tag)}
                        aria-pressed={isSelected}
                      >
                        <Tag className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{tag}</span>
                        {isSelected && (
                          <X className="ml-auto h-3 w-3 flex-shrink-0 opacity-60 hover:opacity-100" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="text-sm font-medium tabular-nums text-foreground">0.1.0</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
