import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getProfile, logout, type AuthUser, type LoginResult } from '@ihui/api-client'
import { initApi, getToken, getRefreshToken, setTokenPair, clearAllTokens } from '../../lib/token'
import { startAutoRefresh, scheduleRefreshAlarm, doRefresh } from '../../lib/token-utils'
import { useNotificationWebSocket } from '../../lib/use-websocket'
import { NotificationProvider, useNotificationStore } from '../../lib/notification-store'
import { useI18n } from '../../src/i18n'
import LoginPage from './pages/LoginPage'
import NotificationPanel from './NotificationPanel'

const TABS = [
  { to: '/chat', labelKey: 'nav.chat', icon: '💬' },
  { to: '/profile', labelKey: 'nav.profile', icon: '👤' },
  { to: '/wallet', labelKey: 'nav.wallet', icon: '💰' },
  { to: '/courses', labelKey: 'nav.courses', icon: '📚' },
  { to: '/settings', labelKey: 'nav.settings', icon: '⚙️' },
]

function isUnauthorized(res: { success: false; error: string; status?: number }): boolean {
  if (res.status === 401) return true
  return /401|未授权|unauthorized/i.test(res.error)
}

function SidepanelInner() {
  const navigate = useNavigate()
  const { t } = useI18n()
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
      const storedToken = getToken()
      setTokenState(storedToken)
      setAuthed(!!storedToken)
      if (storedToken) {
        let res = await getProfile()
        if (cancelled) return
        if (!res.success && isUnauthorized(res)) {
          const refreshed = await doRefresh()
          if (cancelled) return
          if (refreshed) {
            res = await getProfile()
          } else {
            await clearAllTokens()
            setTokenState(null)
            setAuthed(false)
            setReady(true)
            return
          }
        }
        if (res.success) {
          setUser(res.data)
          const cur = getToken()
          if (cur) scheduleRefreshAlarm(cur)
        }
      }
      startAutoRefresh()
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onLoginSuccess = async (result: LoginResult) => {
    await setTokenPair({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    })
    setTokenState(result.accessToken)
    setAuthed(true)
    scheduleRefreshAlarm(result.accessToken)
    startAutoRefresh()
    const res = await getProfile()
    if (res.success) setUser(res.data)
  }

  const onLogout = async () => {
    await logout(getRefreshToken() || '')
    await clearAllTokens()
    setTokenState(null)
    setAuthed(false)
    setUser(null)
    navigate('/login', { replace: true })
  }

  if (!ready) {
    return <div className="sp-loading">{t('common.loading')}</div>
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
          aria-label={t('nav.notifications')}
          title={t('nav.notifications')}
        >
          🔔
          {unreadCount > 0 ? <span className="sp-notify-badge">{unreadCount}</span> : null}
        </button>
        <span
          className={`sp-ws-dot ${wsConnected ? 'connected' : 'disconnected'}`}
          title={wsConnected ? t('notification.connected') : t('notification.disconnected')}
          aria-label={wsConnected ? t('notification.connected') : t('notification.disconnected')}
        />
        <span className="sp-user">{user?.nickname || ''}</span>
      </header>
      <div className="sp-body">
        <nav className="sp-tabs" aria-label="导航">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }: { isActive: boolean }) =>
                `sp-tab ${isActive ? 'active' : ''}`
              }
            >
              <span className="sp-tab-icon" aria-hidden>
                {tab.icon}
              </span>
              <span className="sp-tab-label">{t(tab.labelKey)}</span>
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
