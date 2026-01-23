import { Sidebar } from './Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="dark flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto scrollbar-thin">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
