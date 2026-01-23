import { NavLink } from 'react-router-dom'
import { useAtom } from 'jotai'
import { MessageSquare, Star, Settings, Info, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import { conversationCountsAtom, favoriteCountsAtom } from '@/utils/atoms'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  badgeAtom?: 'conversations' | 'favorites'
}

const navItems: NavItem[] = [
  { path: '/conversations', label: 'Conversations', icon: MessageSquare, badgeAtom: 'conversations' },
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
    <aside className="w-60 h-screen flex flex-col border-r border-border bg-card/50 gradient-mesh">
      {/* Logo */}
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center shadow-glow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold tracking-tight">Chat Central</h1>
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
                      'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer kbd-focus',
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
                          'w-4 h-4 transition-transform',
                          isActive ? 'scale-110' : 'group-hover:scale-105'
                        )}
                      />
                      <span>{item.label}</span>
                      {badgeCount !== undefined && badgeCount > 0 && (
                        <span
                          className={cn(
                            'ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums min-w-[1.5rem] text-center',
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
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="text-sm font-medium text-foreground tabular-nums">0.1.0</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
