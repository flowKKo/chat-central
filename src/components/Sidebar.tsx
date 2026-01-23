import { NavLink } from 'react-router-dom'
import { MessageSquare, Star, Settings, Info, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  badge?: number
}

const navItems: NavItem[] = [
  { path: '/conversations', label: 'Conversations', icon: MessageSquare },
  { path: '/favorites', label: 'Favorites', icon: Star },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/about', label: 'About', icon: Info },
]

export function Sidebar() {
  return (
    <aside className="w-60 h-screen flex flex-col border-r border-border bg-card/50">
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
      <nav className="flex-1 p-3">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer',
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
                  {item.badge && (
                    <span
                      className={cn(
                        'ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="text-sm font-medium text-foreground">0.1.0</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
