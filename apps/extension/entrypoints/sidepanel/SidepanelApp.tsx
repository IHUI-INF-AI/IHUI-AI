import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { getProfile, logout, type AuthUser, type LoginResult } from '@ihui/api-client'
import { initApi, getToken, getRefreshToken, setTokenPair, clearAllTokens } from '../../lib/token'
import { startAutoRefresh, scheduleRefreshAlarm, doRefresh } from '../../lib/token-utils'
import { useNotificationWebSocket } from '../../lib/use-websocket'
import { NotificationProvider, useNotificationStore } from '../../lib/notification-store'
import { useI18n } from '../../src/i18n'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import WalletPage from './pages/WalletPage'
import CoursePage from './pages/CoursePage'
import OrderPage from './pages/OrderPage'
import SettingsPage from './pages/SettingsPage'
import AgentPage from './pages/AgentPage'
import VocabularyPage from './pages/VocabularyPage'
import NotificationPanel from './NotificationPanel'
import AIAppsPage from './pages/AIAppsPage'
import ContentAppsPage from './pages/ContentAppsPage'
import MeAppsPage from './pages/MeAppsPage'
import { ComingSoonPage } from './pages/ComingSoonPage'
// 阶段 1-3 实现的核心页面(2026-07-25)
import DashboardPage from './pages/DashboardPage'
import NotificationsPage from './pages/NotificationsPage'
import FavoritesPage from './pages/FavoritesPage'
import PointsPage from './pages/PointsPage'
import VipPage from './pages/VipPage'
import ArticlesPage from './pages/ArticlesPage'
import NewsPage from './pages/NewsPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import SearchPage from './pages/SearchPage'
import AiSkillsPage from './pages/AiSkillsPage'
import ImageGenPage from './pages/ImageGenPage'
import MemoryPage from './pages/MemoryPage'
// 阶段 4-5 实现的页面(2026-07-25)
import MessagesPage from './pages/MessagesPage'
import FollowingPage from './pages/FollowingPage'
import AiNewsPage from './pages/AiNewsPage'
import ModelsPage from './pages/ModelsPage'
import ChatHistoryPage from './pages/ChatHistoryPage'
import ChatFavoritesPage from './pages/ChatFavoritesPage'
import ChatTemplatesPage from './pages/ChatTemplatesPage'
import PlazaPage from './pages/PlazaPage'
import CirclesPage from './pages/CirclesPage'
import TopicsPage from './pages/TopicsPage'
import AsksPage from './pages/AsksPage'
import FansPage from './pages/FansPage'
import MemberPage from './pages/MemberPage'
import DistributionPage from './pages/DistributionPage'
import InvitationsPage from './pages/InvitationsPage'

const WEB_BASE = 'https://ihui.ai'

// 5 主 tab(2026-07-25 重构):对话 / AI / 内容 / 我的 / 设置
const TABS = [
  { to: '/chat', labelKey: 'nav.chat', icon: '💬' },
  { to: '/ai', labelKey: 'nav.ai', icon: '🤖' },
  { to: '/content', labelKey: 'nav.content', icon: '📚' },
  { to: '/me', labelKey: 'nav.me', icon: '👤' },
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

  // 转发 WS 消息到 background,供 agent-control bridge 监听 agent.action 指令
  useEffect(() => {
    if (!lastMessage) return
    void chrome.runtime
      .sendMessage({ type: 'ws.notification', payload: lastMessage })
      .catch(() => {})
  }, [lastMessage])

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

  // 监听 popup 通过 chrome.storage.session 写入的 pending route
  useEffect(() => {
    if (!ready || !authed) return
    const tryConsume = () => {
      void chrome.storage.session
        ?.get('ihui_pending_route')
        .then((res) => {
          const route = res['ihui_pending_route']
          if (typeof route === 'string' && route.startsWith('/')) {
            navigate(route, { replace: true })
            void chrome.storage.session?.remove('ihui_pending_route')
          }
        })
        .catch(() => {})
    }
    tryConsume()
    const listener = (msg: { type?: string; payload?: { route?: string } }) => {
      if (msg?.type === 'ws.pending_route' && msg.payload?.route) {
        navigate(msg.payload.route, { replace: true })
        void chrome.storage.session?.remove('ihui_pending_route')
      }
    }
    chrome.runtime.onMessage.addListener(
      listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
    )
    return () => {
      chrome.runtime.onMessage.removeListener(
        listener as Parameters<typeof chrome.runtime.onMessage.removeListener>[0],
      )
    }
  }, [ready, authed, navigate])

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
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
        {t('common.loading')}
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="flex flex-col h-screen w-full">
        <LoginPage onSuccess={onLoginSuccess} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <header className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border bg-card shrink-0">
        <span className="font-semibold text-sm mr-auto">IHUI AI</span>
        <button
          type="button"
          className="relative bg-transparent border-none cursor-pointer p-0.5 text-sm leading-none text-inherit shrink-0 hover:opacity-70"
          onClick={() => setVisible(true)}
          aria-label={t('nav.notifications')}
          title={t('nav.notifications')}
        >
          <span aria-hidden>🔔</span>
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-1 min-w-3.5 h-3.5 px-1 rounded-md bg-destructive text-primary-foreground text-[9px] leading-3.5 text-center font-semibold">
              {unreadCount}
            </span>
          ) : null}
        </button>
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${wsConnected ? 'bg-primary' : 'bg-muted-foreground'}`}
          title={wsConnected ? t('notification.connected') : t('notification.disconnected')}
          aria-label={wsConnected ? t('notification.connected') : t('notification.disconnected')}
        />
        <span className="text-xs text-muted-foreground truncate max-w-[80px] md:max-w-[120px]">
          {user?.nickname || ''}
        </span>
      </header>
      <div className="flex flex-1 min-h-0">
        <nav
          className="flex flex-col shrink-0 w-16 md:w-20 bg-card border-r border-border py-1"
          aria-label="导航"
        >
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }: { isActive: boolean }) =>
                `flex flex-col items-center gap-0.5 py-2.5 px-1 text-[11px] border-l-2 border-transparent no-underline ${
                  isActive
                    ? 'text-primary border-l-primary bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`
              }
            >
              <span className="text-lg leading-none" aria-hidden>
                {tab.icon}
              </span>
              <span className="leading-tight">{t(tab.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 overflow-auto bg-background">
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
      <Routes>
        <Route element={<SidepanelInner />}>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          {/* 对话 */}
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/history" element={<ChatHistoryPage />} />
          <Route path="/chat/favorites" element={<ChatFavoritesPage />} />
          <Route path="/chat/templates" element={<ChatTemplatesPage />} />
          {/* 词汇(独立功能,保留) */}
          <Route path="/vocabulary" element={<VocabularyPage />} />
          {/* 课程(独立功能,保留) */}
          <Route path="/courses" element={<CoursePage />} />
          {/* AI 应用中心 */}
          <Route path="/ai" element={<AIAppsPage />} />
          <Route path="/ai/agents" element={<AgentPage />} />
          <Route path="/ai/agents/:id" element={<AgentPage />} />
          <Route path="/ai/skills" element={<AiSkillsPage />} />
          <Route path="/ai/image-gen" element={<ImageGenPage />} />
          <Route path="/ai/memory" element={<MemoryPage />} />
          <Route path="/ai/news" element={<AiNewsPage />} />
          <Route path="/ai/models" element={<ModelsPage />} />
          {/* 内容中心 */}
          <Route path="/content" element={<ContentAppsPage />} />
          <Route path="/content/articles" element={<ArticlesPage />} />
          <Route path="/content/news" element={<NewsPage />} />
          <Route path="/content/announcements" element={<AnnouncementsPage />} />
          <Route path="/content/search" element={<SearchPage />} />
          <Route path="/content/plaza" element={<PlazaPage />} />
          <Route path="/content/circles" element={<CirclesPage />} />
          <Route path="/content/topics" element={<TopicsPage />} />
          <Route path="/content/asks" element={<AsksPage />} />
          {/* 个人中心 */}
          <Route path="/me" element={<MeAppsPage />} />
          <Route path="/me/dashboard" element={<DashboardPage />} />
          <Route path="/me/notifications" element={<NotificationsPage />} />
          <Route path="/me/messages" element={<MessagesPage />} />
          <Route path="/me/favorites" element={<FavoritesPage />} />
          <Route path="/me/following" element={<FollowingPage />} />
          <Route path="/me/fans" element={<FansPage />} />
          <Route path="/me/points" element={<PointsPage />} />
          <Route path="/me/vip" element={<VipPage />} />
          <Route path="/me/member" element={<MemberPage />} />
          <Route path="/me/distribution" element={<DistributionPage />} />
          <Route path="/me/invitations" element={<InvitationsPage />} />
          <Route path="/me/profile" element={<ProfilePage />} />
          <Route path="/me/wallet" element={<WalletPage />} />
          <Route path="/me/orders" element={<OrderPage />} />
          {/* 设置 */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/about" element={<ComingSoonPage titleKey="apps.about" webUrl={`${WEB_BASE}/about`} />} />
          <Route path="/settings/contact" element={<ComingSoonPage titleKey="apps.contact" webUrl={`${WEB_BASE}/contact`} />} />
          <Route path="/settings/help" element={<ComingSoonPage titleKey="apps.help" webUrl={`${WEB_BASE}/help`} />} />
          <Route path="/settings/agreement" element={<ComingSoonPage titleKey="apps.agreement" webUrl={`${WEB_BASE}/agreement`} />} />
          <Route path="/settings/pricing" element={<ComingSoonPage titleKey="apps.pricing" webUrl={`${WEB_BASE}/pricing`} />} />
          {/* 旧路由兼容重定向 */}
          <Route path="/agents" element={<Navigate to="/ai/agents" replace />} />
          <Route path="/agents/:id" element={<Navigate to="/ai/agents/:id" replace />} />
          <Route path="/profile" element={<Navigate to="/me/profile" replace />} />
          <Route path="/wallet" element={<Navigate to="/me/wallet" replace />} />
          <Route path="/orders" element={<Navigate to="/me/orders" replace />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Route>
      </Routes>
    </NotificationProvider>
  )
}
