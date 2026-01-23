import { Sidebar } from './Sidebar'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 overflow-auto scrollbar-thin">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </ThemeProvider>
  )
}
