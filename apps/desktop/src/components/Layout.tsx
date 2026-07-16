import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearToken } from '../lib/token'

interface Props {
  user: { nickname: string; username: string } | null
}

const NAV = [
  { to: '/chat', label: 'AI 对话' },
  { to: '/profile', label: '个人中心' },
  { to: '/wallet', label: '钱包' },
  { to: '/courses', label: '课程' },
  { to: '/settings', label: '设置' },
]

export default function Layout({ user }: Props) {
  const navigate = useNavigate()

  const onLogout = () => {
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
          <span className="user-name">{user?.nickname || user?.username || '未登录'}</span>
        </div>
      </aside>
      <main className="main-content">
        <Outlet context={{ onLogout }} />
      </main>
    </div>
  )
}
