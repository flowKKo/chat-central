import type { LucideIcon } from 'lucide-react'
import { useAtom } from 'jotai'
import { ChevronDown, Github, MessageSquare, Settings, Sparkles, Tag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { browser } from 'wxt/browser'
import {
  allTagsAtom,
  clearTagFiltersAtom,
  conversationCountsAtom,
  loadAllTagsAtom,
  selectedFilterTagsAtom,
  toggleTagFilterAtom,
} from '@/utils/atoms'
import { cn } from '@/utils/cn'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  badgeAtom?: 'conversations'
}

const navItems: NavItem[] = [
  {
    path: '/conversations',
    label: 'conversations',
    icon: MessageSquare,
    badgeAtom: 'conversations',
  },
  { path: '/settings', label: 'settings', icon: Settings },
]

export function Sidebar() {
  const { t } = useTranslation('common')
  const [conversationCounts] = useAtom(conversationCountsAtom)
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

  const getBadgeCount = (badgeAtom?: 'conversations') => {
    if (badgeAtom === 'conversations') return conversationCounts.total
    return undefined
  }

  // Only show tags section on conversations page
  const showTagsSection = location.pathname === '/conversations' || location.pathname === '/'

  const version = browser.runtime.getManifest().version

  return (
    <aside className="gradient-mesh flex h-screen w-60 flex-col border-r border-border bg-card/50">
      {/* Logo */}
      <div className="border-b border-border/50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400 shadow-glow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold tracking-tight">{t('appName')}</h1>
            <p className="text-xs text-muted-foreground">{t('appTagline')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto p-3" aria-label="Main navigation">
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
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isActive ? 'scale-110' : 'group-hover:scale-105'
                        )}
                      />
                      <span>{t(item.label)}</span>
                      {badgeCount !== undefined && badgeCount > 0 && (
                        <span
                          className={cn(
                            'ml-auto min-w-[1.5rem] rounded-full px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums',
                            isActive
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
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
                {t('tags')}
                {selectedTags.length > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {selectedTags.length}
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  isTagsExpanded && 'rotate-180'
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
                    {t('clearFilters')}
                  </button>
                )}
                <div className="ml-2 space-y-0.5">
                  {allTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag)
                    return (
                      <button
                        type="button"
                        key={tag}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                        )}
                        onClick={() => toggleTagFilter(tag)}
                        aria-pressed={isSelected}
                      >
                        <span
                          className={cn(
                            'flex-shrink-0 text-[10px]',
                            isSelected ? 'text-primary/60' : 'text-muted-foreground/60'
                          )}
                        >
                          #
                        </span>
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
          <p className="text-xs text-muted-foreground">
            v<span className="tabular-nums">{version}</span>
          </p>
          <a
            href="https://github.com/flowKKo/chat-central"
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg p-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('viewOnGithub')}
          >
            <Github className="h-3.5 w-3.5" />
            {t('github')}
          </a>
        </div>
      </div>
    </aside>
  )
}
