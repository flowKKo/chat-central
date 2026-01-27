import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import ConversationsManager from '@/components/ConversationsManager'
import { DashboardLayout } from '@/components/DashboardLayout'
import { SettingsPanel } from '@/components/SettingsPanel'

export default function App() {
  return (
    <HashRouter>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/conversations" replace />} />
          <Route path="/conversations" element={<ConversationsManager />} />
          <Route path="/settings" element={<SettingsPanel />} />
        </Routes>
      </DashboardLayout>
    </HashRouter>
  )
}
