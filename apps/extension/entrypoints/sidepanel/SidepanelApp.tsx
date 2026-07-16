import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getProfile, type AuthUser } from '@ihui/api-client'
import { initApi, getToken, setToken, clearToken } from '../../lib/token'
import { useNotificationWebSocket } from '../../lib/use-websocket'
import { NotificationProvider, useNotificationStore } from '../../lib/notification-store'
import LoginPage from './pages/LoginPage'
import NotificationPanel from './NotificationPanel'

const TABS = [
  { to: '/chat', label: '对话', icon: '💬' },
  { to: '/profile', label: '我的', icon: '👤' },
  { to: '/wallet', label: '钱包', icon: '💰' },
  { to: '/courses', label: '课程', icon: '📚' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

function SidepanelInner() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const { connected: wsConnected, lastMessage } = useNotificationWebSocket(token)
  const { addFromWs, unreadCount, setVisible } = useNotificationStore()

  useEffect(() => {
    addFromWs(lastMessage)
  }, [lastMessage, addFromWs])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await initApi()
      if (cancelled) return
      const t = getToken()
      setTokenState(t)
      setAuthed(!!t)
      if (t) {
        const res = await getProfile()
        if (cancelled) return
        if (res.success) setUser(res.data)
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onLoginSuccess = async (newToken: string) => {
    await setToken(newToken)
    setTokenState(newToken)
    setAuthed(true)
    const res = await getProfile()
    if (res.success) setUser(res.data)
  }

  const onLogout = () => {
    clearToken()
    setTokenState(null)
    setAuthed(false)
    setUser(null)
    navigate('/login', { replace: true })
  }

  if (!ready) {
    return <div className="sp-loading">加载中...</div>
  }

  if (!authed) {
    return (
      <div className="sidepanel-layout">
        <LoginPage onSuccess={onLoginSuccess} />
      </div>
    )
  }

  return (
    <div className="sidepanel-layout">
      <header className="sp-header">
        <span className="sp-brand">IHUI AI</span>
        <button
          type="button"
          className="sp-notify-btn"
          onClick={() => setVisible(true)}
          aria-label="通知"
          title="通知"
        >
          🔔
          {unreadCount > 0 ? <span className="sp-notify-badge">{unreadCount}</span> : null}
        </button>
        <span
          className={`sp-ws-dot ${wsConnected ? 'connected' : 'disconnected'}`}
          title={wsConnected ? '实时通知已连接' : '实时通知未连接'}
          aria-label={wsConnected ? '实时通知已连接' : '实时通知未连接'}
        />
        <span className="sp-user">{user?.nickname || ''}</span>
      </header>
      <div className="sp-body">
        <nav className="sp-tabs" aria-label="导航">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }: { isActive: boolean }) =>
                `sp-tab ${isActive ? 'active' : ''}`
              }
            >
              <span className="sp-tab-icon" aria-hidden>
                {t.icon}
              </span>
              <span className="sp-tab-label">{t.label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="sp-main">
          <Outlet context={{ onLogout }} />
        </main>
      </div>
      <NotificationPanel />
    </div>
  )
}

export default function SidepanelApp() {
  return (
    <NotificationProvider>
      <SidepanelInner />
    </NotificationProvider>
  )
}
