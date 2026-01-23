import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AboutPanel } from '@/components/AboutPanel'
import ConversationsManager from '@/components/ConversationsManager'
import { DashboardLayout } from '@/components/DashboardLayout'
import { SettingsPanel } from '@/components/SettingsPanel'

export default function App() {
  return (
    <HashRouter>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/conversations" replace />} />
          <Route path="/conversations" element={<ConversationsManager mode="all" />} />
          <Route path="/favorites" element={<ConversationsManager mode="favorites" />} />
          <Route path="/settings" element={<SettingsPanel />} />
          <Route path="/about" element={<AboutPanel />} />
        </Routes>
      </DashboardLayout>
    </HashRouter>
  )
}
