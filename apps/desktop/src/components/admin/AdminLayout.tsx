/**
 * Admin shell 布局 — 侧边栏 + 顶栏 + 内容区(react-router Outlet)。
 *
 * - 侧边栏:5 大块导航(Dashboard / Users / Content / Orders / Settings)。
 * - 顶栏:标题 + 当前时间 + 主题切换 + 退出。
 * - 内容区:`<Outlet />` 渲染匹配到的子页面。
 * - 独立窗口:`tauri.conf.json` 声明 label=admin 的窗口,url=/admin,
 *   此组件只负责"渲染",不参与窗口创建/关闭(由 `lib/admin-window.ts` 承担)。
 */
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n'

interface NavItem {
  to: string
  labelKey: string
  testId: string
}

const NAV: NavItem[] = [
  { to: '/admin', labelKey: 'admin.nav.dashboard', testId: 'dashboard' },
  { to: '/admin/users', labelKey: 'admin.nav.users', testId: 'users' },
  { to: '/admin/content', labelKey: 'admin.nav.content', testId: 'content' },
  { to: '/admin/orders', labelKey: 'admin.nav.orders', testId: 'orders' },
  { to: '/admin/settings', labelKey: 'admin.nav.settings', testId: 'settings' },
]

function formatNow(): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

export default function AdminLayout() {
  const { t } = useI18n()
  const location = useLocation()
  const [now, setNow] = useState(() => formatNow())
  const [dark, setDark] = useState<boolean>(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const id = setInterval(() => setNow(formatNow()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    document.title = t('admin.title')
  }, [t, location.pathname])

  const onToggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <div className="admin-shell" data-testid="admin-shell">
      <aside className="admin-sidebar" aria-label="admin navigation">
        <div className="admin-brand">
          <span className="admin-brand-mark">IHUI</span>
          <span className="admin-brand-sub">{t('admin.title')}</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/admin'}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
              data-testid={`admin-nav-${n.testId}`}
            >
              {t(n.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-meta">{now}</span>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <h1 className="admin-topbar-title">{t('admin.title')}</h1>
          <div className="admin-topbar-actions">
            <button
              type="button"
              className="admin-topbar-btn"
              onClick={onToggleTheme}
              aria-label="toggle theme"
              data-testid="admin-theme-toggle"
            >
              {dark ? '☀' : '☾'}
            </button>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
