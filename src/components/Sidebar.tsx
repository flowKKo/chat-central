import { NavLink } from 'react-router-dom'
import { MessageSquare, Star, Settings, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { path: '/conversations', label: 'Conversations', icon: MessageSquare },
  { path: '/favorites', label: 'Favorites', icon: Star },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/about', label: 'About', icon: Info },
]

export function Sidebar() {
  return (
    <aside className="w-56 h-screen flex flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold">Chat Central</h1>
        <p className="text-xs text-muted-foreground">AI Conversation Manager</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Version 0.1.0</p>
      </div>
    </aside>
  )
}
