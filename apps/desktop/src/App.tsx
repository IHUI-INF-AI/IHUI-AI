import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getProfile, type AuthUser } from '@ihui/api-client'
import { initApi, getToken } from './lib/token'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import WalletPage from './pages/WalletPage'
import CoursePage from './pages/CoursePage'
import SettingsPage from './pages/SettingsPage'
import OrderPage from './pages/OrderPage'
import './app.css'

export default function App() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const token = getToken()

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

  if (!ready) {
    return <div className="app-loading">加载中...</div>
  }

  if (!token) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout user={user} />}>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatWithLogout />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/courses" element={<CoursePage />} />
          <Route path="/orders" element={<OrderPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function ChatWithLogout() {
  return <ChatPage onLogout={() => window.location.assign('/login')} />
}
