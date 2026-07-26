/**
 * Popup — 登录入口 + 用户信息 + 快捷操作(打开侧边栏 / 收藏 / 通知 / 复制 URL / 打开网页版)。
 *
 * 快捷操作依赖 background 通过 message-router 提供的 api.proxy + sidePanel.open 能力。
 *
 * 2026-07-26 改造:登录表单改用共享 @ihui/ui-react.LoginForm(2026-07-26 立)。
 *
 *   - 共享 LoginForm 包含:4 tab 切换(email/phone/password/qr) + 三方登录(8 平台)
 *     + 注册/忘记密码链接 + 协议复选框 + OTP 验证码输入 + 倒计时 + 错误提示。
 *   - popup 物理空间 ~460×600 限制,4 tab + 8 三方 + 协议 + 注册入口会超 600px,
 *     所以 popup 配置 tabs=['password'] + showThirdParty=false + 简化版协议
 *     (隐含用户已接受),引导用户去 web 端做完整登录(打开网页版按钮)。
 *   - 外壳:依然用 @ihui/ui-react.AuthShell 完整版(2026-07-26 共享),
 *     跟 web 端 LoginDialog 用同一份组件 + 同一份 .login-scope CSS,
 *     popup/sidepanel/web 真正"一模一样"。
 */
import { useEffect, useState } from 'react'
import { getMe, logout, type AuthUser } from '@ihui/api-client'
import { Button, AuthShell, LoginForm, type LoginResult } from '@ihui/ui-react'
import { initApi, setTokenPair, getToken, getRefreshToken, clearAllTokens } from '../../lib/token'
import { startAutoRefresh, scheduleRefreshAlarm } from '../../lib/token-utils'
import { loginApiClient } from '../../lib/login-api'
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

  const onLoginSuccess = async (data: NonNullable<LoginResult['data']>) => {
    await setTokenPair({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    })
    scheduleRefreshAlarm(data.accessToken)
    startAutoRefresh()
    if (data.user) {
      setUser(data.user as AuthUser)
    } else {
      // 登录成功但后端没返回 user → 主动拉一次 /me
      try {
        const me = await getMe()
        if (me.success) setUser(me.data.user)
      } catch {
        /* noop */
      }
    }
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
        {/* 2026-07-26 改造:popup 改用共享 @ihui/ui-react.LoginForm
            - 物理空间 ~460×600 限制,配置 tabs=['password'] + 关闭三方
              + 关闭协议(隐含用户已接受),保持紧凑
            - 注册/忘记密码 → 引导打开网页版
            - 外壳依然用共享 AuthShell 完整版(logo + welcome 浅/深主题切换)
            - 深色主题:useSystemTheme 跟随 OS 偏好 */}
        <AuthShell
          title={t('auth.login')}
          subtitle={t('auth.loginSubtitle')}
          className="w-full"
        >
          <LoginForm
            t={t}
            apiClient={loginApiClient}
            tabs={['password']}
            showThirdParty={false}
            showAgreement={false}
            showRegisterLink
            showForgotPassword
            onForgotPassword={openWeb}
            onRegister={openWeb}
            onSuccess={onLoginSuccess}
            inputClassName="h-9"
            buttonClassName="h-9 w-full"
          />
          <div className="mt-3">
            <QuickActionButton
              label={t('popup.openWeb')}
              icon="🌐"
              onClick={openWeb}
              variant="default"
            />
          </div>
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
