import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getProfile, type UserProfile as ApiUserProfile } from '@ihui/api-client'
import { initApi, getToken, setToken, clearToken } from '../../lib/token'
import LoginPage from './pages/LoginPage'

const TABS = [
  { to: '/chat', label: '对话', icon: '💬' },
  { to: '/profile', label: '我的', icon: '👤' },
  { to: '/wallet', label: '钱包', icon: '💰' },
  { to: '/courses', label: '课程', icon: '📚' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

export default function SidepanelApp() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [user, setUser] = useState<ApiUserProfile | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await initApi()
      if (cancelled) return
      const has = !!getToken()
      setAuthed(has)
      if (has) {
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

  const onLoginSuccess = async (token: string) => {
    await setToken(token)
    setAuthed(true)
    const res = await getProfile()
    if (res.success) setUser(res.data)
  }

  const onLogout = () => {
    clearToken()
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
        <span className="sp-user">{user?.nickname || user?.username || ''}</span>
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
    </div>
  )
}
