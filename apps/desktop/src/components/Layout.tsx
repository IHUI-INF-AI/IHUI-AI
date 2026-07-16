import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout as apiLogout, type AuthUser } from '@ihui/api-client'
import { clearToken, getRefreshToken } from '../lib/token'

interface Props {
  user: AuthUser | null
  wsConnected: boolean
}

const NAV = [
  { to: '/chat', label: 'AI 对话' },
  { to: '/profile', label: '个人中心' },
  { to: '/wallet', label: '钱包' },
  { to: '/orders', label: '订单' },
  { to: '/courses', label: '课程' },
  { to: '/settings', label: '设置' },
]

export default function Layout({ user, wsConnected }: Props) {
  const navigate = useNavigate()

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
          {NAV.map((n) => (
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
