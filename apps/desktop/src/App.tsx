import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getProfile, type AuthUser } from '@ihui/api-client'
import { initApi, getToken } from './lib/token'
import { useAgentControlBridge } from './hooks/use-agent-control-bridge'
import { NotificationProvider, useNotificationStore } from './stores/notification'
import { I18nProvider, useI18n } from './i18n'
import Layout from './components/Layout'
import NotificationPanel from './components/NotificationPanel'
import { DesktopWorkPanel } from './components/work-panel/DesktopWorkPanel'
import AdminLayout from './components/admin/AdminLayout'
import AdminGuard from './components/admin/AdminGuard'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminContent from './pages/admin/AdminContent'
import AdminOrders from './pages/admin/AdminOrders'
import AdminSettings from './pages/admin/AdminSettings'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import WalletPage from './pages/WalletPage'
import CoursePage from './pages/CoursePage'
import SettingsPage from './pages/SettingsPage'
import OrderPage from './pages/OrderPage'
import AgentPage from './pages/AgentPage'
import './app.css'

function AppInner() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const token = getToken()
  const { connected: wsConnected, lastMessage } = useAgentControlBridge(token || null)
  const { addFromWs } = useNotificationStore()
  const { t } = useI18n()

  useEffect(() => {
    initApi()
    if (!token) {
      setReady(true)
      return
    }
    let cancelled = false
    void (async () => {
      const res = await getProfile()
      if (cancelled) return
      if (res.success) setUser(res.data)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    addFromWs(lastMessage)
  }, [lastMessage, addFromWs])

  if (!ready) {
    return <div className="app-loading">{t('common.loading')}</div>
  }

  if (!token) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout user={user} wsConnected={wsConnected} />}>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatWithLogout />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/courses" element={<CoursePage />} />
          <Route path="/orders" element={<OrderPage />} />
          <Route path="/agents" element={<AgentPage />} />
          <Route path="/agents/:id" element={<AgentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Route>
        <Route
          path="/admin"
          element={
            <AdminGuard user={user}>
              <AdminLayout />
            </AdminGuard>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
      <NotificationPanel />
      <DesktopWorkPanel />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <NotificationProvider>
        <AppInner />
      </NotificationProvider>
    </I18nProvider>
  )
}

function ChatWithLogout() {
  return <ChatPage onLogout={() => window.location.assign('/login')} />
}
