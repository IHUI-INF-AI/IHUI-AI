/**
 * Popup — 登录入口 + 用户信息 + 快捷操作(打开侧边栏 / 收藏 / 通知 / 复制 URL / 打开网页版)。
 *
 * 快捷操作依赖 background 通过 message-router 提供的 api.proxy + sidePanel.open 能力。
 *
 * 2026-07-26 改造:登录外壳用共享 @ihui/ui-react.AuthShell(完整版,跟 web 端 LoginDialog
 * 完全一致),popup 跟 web 端用同一份 React 组件 + 同一份 CSS(.login-scope / .welcome-img),
 * 真正"一模一样"。ExtensionAuthShell.tsx 已删除,AuthShellCompact 不再使用。
 *
 * 物理空间约束:Chrome 扩展 popup 默认 800x600(pwa 窗口硬限制),AuthShell 完整版外壳
 * (logo + welcome + p-7 + 容器)约占 286px 高度,业务简化后能完全装下;但 4 tab + 8 第三方
 * 登录 + 服务条款勾选 + 注册入口会超 600px,所以 popup 业务保留最简版(2 input + 1 登录按钮
 * + 1 打开网页版链接,引导用户去 web 端做完整登录)。
 */
import { useEffect, useState } from 'react'
import { loginByAccount, getMe, logout, type AuthUser } from '@ihui/api-client'
import { Button, Input, Label, AuthShell } from '@ihui/ui-react'
import { initApi, setTokenPair, getToken, getRefreshToken, clearAllTokens } from '../../lib/token'
import { startAutoRefresh, scheduleRefreshAlarm } from '../../lib/token-utils'
import { useI18n } from '../../src/i18n'
import { sendMessage } from '../../lib/message-router'
import { useSystemTheme } from '../../src/hooks/use-system-theme'
import { QuickActionButton } from '../components/QuickActionButton'
import { NotificationBell } from '../components/NotificationBell'

interface ActiveTab {
  tabId?: number
  url?: string
  title?: string
}

export default function App() {
  const { t } = useI18n()
  // 2026-07-26 改造:popup 启用系统主题跟随(浅/深模式由 OS 决定),让 popup 跟 web 端
  // LoginDialog 用同一份 .login-scope / .welcome-img 共享 CSS,深色模式视觉一致。
  useSystemTheme()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null)
  const [copyHint, setCopyHint] = useState('')

  useEffect(() => {
    // 2026-07-23 修复:原代码 initApi() reject 时 setReady(true) 永不触发 → popup 卡在 loading
    // 改为 .catch 兜底,确保即使 API 初始化失败也能显示登录界面
    initApi()
      .then(async () => {
        if (getToken()) {
          try {
            const res = await getMe()
            if (res.success) setUser(res.data.user)
            else await clearAllTokens()
          } catch {
            await clearAllTokens()
          }
        }
        setReady(true)
      })
      .catch(() => {
        // initApi 失败(chrome.storage 不可用等)也要显示 UI,不能卡在 loading
        setReady(true)
      })
    startAutoRefresh()

    // 查询当前 tab(用于"复制 URL" / "打赏作者" 等)
    void sendMessage<ActiveTab>({
      type: 'tab.queryActive',
      payload: undefined,
      requestId: `tab-${Date.now()}`,
    })
      .then((res) => setActiveTab(res))
      .catch(() => setActiveTab(null))
  }, [])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account || !password) {
      setError(t('auth.loginRequired'))
      return
    }
    setLoading(true)
    setError('')
    const res = await loginByAccount(account, password)
    if (res.success) {
      await setTokenPair({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        expiresIn: res.data.expiresIn,
      })
      scheduleRefreshAlarm(res.data.accessToken)
      startAutoRefresh()
      setUser(res.data.user)
    } else {
      setError(res.error || `${t('auth.login')}${t('common.failed')}`)
    }
    setLoading(false)
  }

  const onLogout = async () => {
    await logout(getRefreshToken() || '')
    await clearAllTokens()
    setUser(null)
  }

  const openSidePanel = async (route: string = '/chat') => {
    try {
      const res = await sendMessage<{ opened: boolean }>({
        type: 'sidePanel.open',
        payload: { tabId: activeTab?.tabId },
        requestId: `sp-${Date.now()}`,
      })
      if (res?.opened && route !== '/chat') {
        // 写入待跳转路由(sidepanel 启动时检测)
        await chrome.storage.session?.set({ ihui_pending_route: route })
      }
    } catch (err) {
      console.warn('[IHUI AI] open side panel failed:', err)
    }
    window.close()
  }

  const copyPageUrl = async () => {
    const url = activeTab?.url
    if (!url) {
      setCopyHint(t('popup.copyFailed'))
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopyHint(t('popup.copySuccess'))
    } catch {
      setCopyHint(t('popup.copyFailed'))
    }
    setTimeout(() => setCopyHint(''), 2000)
  }

  const openWeb = () => {
    const url = 'https://www.ihui.ai/'
    chrome.tabs.create({ url })
    window.close()
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm p-4">
        {t('common.loading')}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-3 min-w-[360px] max-w-[460px] bg-background">
        {/* 2026-07-26 改造:popup 改用完整 AuthShell(去掉 compact),跟 web 端 LoginDialog
            用同一份共享组件 + 同一份 .login-scope / .welcome-img 共享 CSS。
            - 外壳:圆角边框、阴影、p-7、logo + welcome.svg/baiwelcome.svg 浅/深主题切换
            - 业务简化(popup 物理空间 ~460×600 限制):
              去掉 4 tab 切换、8 个第三方登录、服务条款勾选、注册/忘记密码入口
              保留 2 input(账号+密码)+ 1 登录按钮 + 1 打开网页版链接
            - 关闭按钮:popup 不需要(点击外部自动关闭,跟 web 端弹窗不同)
            - 深色主题:由 useSystemTheme 根据 OS 偏好自动切换(.dark class) */}
        <AuthShell
          title={t('auth.login')}
          subtitle={t('auth.loginSubtitle')}
          className="w-full"
        >
          <form onSubmit={onLogin} className="space-y-3 pt-1">
            {error ? (
              <div
                role="alert"
                className="border border-red-500/30 bg-red-500/5 text-red-500 rounded-md px-3 py-2 text-xs flex items-start gap-2"
              >
                <span className="shrink-0 leading-none">⚠</span>
                <span className="flex-1">{error}</span>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="popup-account">{t('auth.phoneOrEmail')}</Label>
              <Input
                id="popup-account"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder={t('auth.phoneOrEmail')}
                disabled={loading}
                className="h-9"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="popup-password">{t('auth.password')}</Label>
              <Input
                id="popup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password')}
                disabled={loading}
                className="h-9"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="h-9 w-full" disabled={loading}>
              {loading ? t('common.loading') : t('auth.login')}
            </Button>
            <QuickActionButton
              label={t('popup.openWeb')}
              icon="🌐"
              onClick={openWeb}
              variant="default"
            />
          </form>
        </AuthShell>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 min-w-[280px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 py-2 border-b border-border flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-base font-semibold shrink-0">
            {user.nickname?.[0] || user.phone?.[0] || '?'}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
              {user.nickname || user.phone}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {(user.roleId ?? 0) >= 1 ? t('auth.roleAdmin') : t('auth.roleUser')}
            </div>
          </div>
        </div>
        <NotificationBell />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {t('popup.quickActions')}
        </div>
        <div className="flex flex-col gap-1">
          <QuickActionButton
            label={t('popup.openChat')}
            icon="💬"
            onClick={() => openSidePanel('/chat')}
            variant="primary"
          />
          <QuickActionButton
            label={t('popup.openSidePanel')}
            icon="📌"
            onClick={() => openSidePanel('/chat')}
          />
          <QuickActionButton
            label={t('nav.vocabulary')}
            icon="📖"
            onClick={() => openSidePanel('/vocabulary')}
          />
          <QuickActionButton
            label={t('nav.profile')}
            icon="👤"
            onClick={() => openSidePanel('/profile')}
          />
          <QuickActionButton
            label={t('nav.wallet')}
            icon="💰"
            onClick={() => openSidePanel('/wallet')}
          />
          <QuickActionButton
            label={copyHint || (activeTab?.url ? `${t('popup.copySuccess')} URL` : '—')}
            icon="🔗"
            onClick={copyPageUrl}
            disabled={!activeTab?.url}
          />
          <QuickActionButton
            label={t('popup.openWeb')}
            icon="🌐"
            onClick={openWeb}
            variant="default"
          />
        </div>
      </div>
      <button
        type="button"
        className="bg-card text-destructive border border-destructive rounded-md px-3.5 py-2 text-[13px] cursor-pointer hover:bg-destructive/10"
        onClick={onLogout}
      >
        {t('auth.logout')}
      </button>
    </div>
  )
}
