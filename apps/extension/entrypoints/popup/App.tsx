/**
 * Popup — 登录入口 + 用户信息 + 快捷操作(打开侧边栏 / 收藏 / 通知 / 复制 URL / 打开网页版)。
 *
 * 快捷操作依赖 background 通过 message-router 提供的 api.proxy + sidePanel.open 能力。
 *
 * 2026-07-26 改造:登录界面接入共享 @ihui/ui-react.LoginForm(4 tab + 8 第三方登录 +
 * 协议复选框 + 注册/忘记密码链接),与 web 端 LoginDialog 视觉/功能 100% 一致。彻底
 * 替换本地手写 form,根治"扩展端登录界面没有登录方式选择/三方登录/没共用"问题(2026-07-26
 * 用户反馈)。
 *
 * 物理空间约束:Chrome 扩展 popup 默认 800x600,AuthShell 完整版外壳 + 4 tab + 8 第三方
 * 登录 + 协议勾选 + 注册入口会超 600px,input/button 缩到 h-9 + 外层 max-h-[600px]
 * overflow-y-auto 解决滚动。
 */
import { useEffect, useMemo, useState } from 'react'
import { getMe, logout, type AuthUser } from '@ihui/api-client'
import { AuthShell, LoginForm, type LoginResult } from '@ihui/ui-react'
import { initApi, getToken, getRefreshToken, clearAllTokens } from '../../lib/token'
import { startAutoRefresh } from '../../lib/token-utils'
import { createExtensionLoginApiClient } from '../../lib/login-api-client'
import { useI18n } from '../../src/i18n'
import { sendMessage } from '../../lib/message-router'
import { useSystemTheme } from '../../src/hooks/use-system-theme'
import { useExtensionThirdPartyAuth } from '../../src/hooks/use-extension-third-party-auth'
import { PENDING_ROUTE_STORAGE_KEY } from '@ihui/shared/constants'
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
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null)
  const [copyHint, setCopyHint] = useState('')
  // 2026-07-26 改造:登录界面改用共享 @ihui/ui-react.LoginForm(4 tab + 8 第三方登录 +
  // 协议复选框 + 注册/忘记密码链接),apiClient 适配扩展端 chrome.storage + token 刷新,
  // thirdParty 由 useExtensionThirdPartyAuth hook 注入 8 平台配置。
  const loginApiClient = useMemo(() => createExtensionLoginApiClient(), [])
  const thirdParty = useExtensionThirdPartyAuth()

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

  const onLoginSuccess = async (data: LoginResult) => {
    // apiClient 已经把 token 写进 chrome.storage 并启动 refresh,这里只需同步 user
    setUser(data.user as AuthUser)
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
        await chrome.storage.session?.set({ [PENDING_ROUTE_STORAGE_KEY]: route })
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
      <div className="p-3 min-w-[360px] max-w-[460px] bg-background max-h-[600px] overflow-y-auto">
        {/* 2026-07-26 改造:popup 接入共享 @ihui/ui-react.LoginForm + AuthShell,
            与 web 端 LoginDialog 用同一份组件 + 同一份 .login-scope / .welcome-img CSS,
            4 tab(邮箱/手机/密码/扫码)+ 8 第三方登录 + 协议复选框 + 注册/忘记密码链接,
            视觉/功能 100% 一致。
            物理空间 ~460×600:input/button 缩到 h-9 + 外层 max-h + overflow-y-auto。 */}
        <AuthShell title={t('auth.login')} subtitle={t('auth.loginSubtitle')} className="w-full">
          <LoginForm
            t={t}
            apiClient={loginApiClient}
            thirdParty={thirdParty.config}
            showAgreement
            agreementMode="notice-dialog"
            showRegisterLink
            showForgotPassword
            onRegister={openWeb}
            onForgotPassword={openWeb}
            onSuccess={onLoginSuccess}
            inputClassName="h-9"
            buttonClassName="h-9 w-full"
          />
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
