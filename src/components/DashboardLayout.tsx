import { Sidebar } from './Sidebar'
import { I18nProvider } from '@/components/providers/I18nProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <div className="flex h-screen bg-background text-foreground">
          <Sidebar />
          <main className="scrollbar-thin flex-1 overflow-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </I18nProvider>
    </ThemeProvider>
  )
}
