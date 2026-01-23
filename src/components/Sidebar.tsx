import type { LucideIcon } from 'lucide-react'
import { useAtom } from 'jotai'
import { Info, MessageSquare, Settings, Sparkles, Star } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { conversationCountsAtom, favoriteCountsAtom } from '@/utils/atoms'
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

  const getBadgeCount = (badgeAtom?: 'conversations' | 'favorites') => {
    if (badgeAtom === 'conversations') return conversationCounts.total
    if (badgeAtom === 'favorites') return favoriteCounts.total
    return undefined
  }

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
      <nav className="flex-1 p-3" aria-label="Main navigation">
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
                      <span>{item.label}</span>
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
