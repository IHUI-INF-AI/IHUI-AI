import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout as apiLogout, type AuthUser } from '@ihui/api-client'
import { clearToken, getRefreshToken } from '../lib/token'
import { useNotificationStore } from '../stores/notification'
import { useI18n } from '../i18n'

interface Props {
  user: AuthUser | null
  wsConnected: boolean
}

export default function Layout({ user, wsConnected }: Props) {
  const navigate = useNavigate()
  const { unreadCount, setVisible } = useNotificationStore()
  const { t } = useI18n()

  const nav = [
    { to: '/chat', label: t('nav.chat') },
    { to: '/agents', label: t('nav.agents') },
    { to: '/profile', label: t('nav.profile') },
    { to: '/wallet', label: t('nav.wallet') },
    { to: '/orders', label: t('nav.orders') },
    { to: '/courses', label: t('nav.courses') },
    { to: '/settings', label: t('nav.settings') },
  ]

  const onLogout = async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      try {
        await apiLogout(refreshToken)
      } catch {
        // 网络异常也继续清除本地 token
      }
    }
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="desktop-layout">
      <aside className="sidebar">
        <div className="brand">IHUI AI</div>
        <nav>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="notify-btn"
            onClick={() => setVisible(true)}
            aria-label="通知"
            title="通知"
          >
            <span className="notify-icon">🔔</span>
            {unreadCount > 0 ? <span className="notify-badge">{unreadCount}</span> : null}
          </button>
          <span
            className={`ws-status-dot ${wsConnected ? 'connected' : 'disconnected'}`}
            title={wsConnected ? '实时通知已连接' : '实时通知未连接'}
            aria-label={wsConnected ? '实时通知已连接' : '实时通知未连接'}
          />
          <span className="user-name">{user?.nickname || '未登录'}</span>
        </div>
      </aside>
      <main className="main-content">
        <Outlet context={{ onLogout }} />
      </main>
    </div>
  )
}
