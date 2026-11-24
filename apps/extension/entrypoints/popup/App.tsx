// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import {
  BookOpen,
  Globe,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  User,
  Wallet,
} from 'lucide-react'
import { getMe, logout, type AuthUser } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { classifyRefreshFailureStatus } from '@ihui/shared/auth/auto-login-policy'
import { AuthShell, LoginForm, type LoginResult } from '@ihui/ui-react'
import { initApi, getToken, getRefreshToken, clearAllTokens } from '../../lib/token'
import { startAutoRefresh } from '../../lib/token-utils'
import { createExtensionLoginApiClient } from '../../lib/login-api-client'
import { useI18n } from '../../src/i18n'
import { sendMessage } from '../../lib/message-router'
import { useSystemTheme } from '../../src/hooks/use-system-theme'
import { useExtensionThirdPartyAuth } from '../../src/hooks/use-extension-third-party-auth'
// 票 L28754:登录方式优先级按访客 IP 地区走,判据住在 @ihui/ui-react 的 planLoginRegion
import { useExtensionLoginPlan } from '../../src/hooks/use-extension-login-plan'
import { PENDING_ROUTE_STORAGE_KEY } from '@ihui/shared/constants'
import { QuickActionButton } from '../components/QuickActionButton'
import { NotificationBell } from '../components/NotificationBell'

interface ActiveTab {
  tabId?: number
  url?: string
  title?: string
}

/**
 * Popup 身份探测唯一出口(2026-10-26 根治扩展端「账号总是要重新登录」)。
 *
 * 旧实现:getMe **任何**失败(含网络错误/超时/5xx/无 status)都 `clearAllTokens()`
 * —— 一次网络抖动就把登录态清光。现在判据复用全仓唯一出口 `classifyRefreshFailureStatus`
 * (@ihui/shared/auth/auto-login-policy,第二参数透传 errorCode,REFRESH_TOKEN_STALE 算瞬时):
 * - rejected(服务端明确否定凭据,401/403)⇒ 清;
 * - transient(5xx/超时/无 status)⇒ 一条不清,凭据留着等下一次探测/续期 tick;
 * - 抛出的异常(网络层)= 未判定,同样不清(§0.3「没判」绝不实现成「删数据」)。
 *
 * 依赖注入以便测试按镜像纪律直接驱动判据(见 tests/auth-probe-credential-guard.test.ts)。
 */
export async function probeIdentity(deps: {
  getMe: () => Promise<ApiResult<{ user: AuthUser }>>
  clearAllTokens: () => Promise<void>
}): Promise<AuthUser | null> {
  try {
    const res = await deps.getMe()
    if (res.success) return res.data.user
    if (classifyRefreshFailureStatus(res.status, res.errorCode) === 'rejected') {
      await deps.clearAllTokens()
    }
    return null
  } catch {
    return null
  }
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
  const loginPlan = useExtensionLoginPlan(thirdParty.config.providers)

  useEffect(() => {
    // 2026-07-23 修复:原代码 initApi() reject 时 setReady(true) 永不触发 → popup 卡在 loading
    // 改为 .catch 兜底,确保即使 API 初始化失败也能显示登录界面
    initApi()
      .then(async () => {
        if (getToken()) {
          // 2026-10-26:探测失败的分型与是否清凭据一律收进 probeIdentity(单源判据),
          // 这里只在 rejected 时被它清掉;transient/异常保留凭据,下一次打开或 tick 再试。
          setUser(await probeIdentity({ getMe, clearAllTokens }))
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

  const openSidePanel = async (route?: string) => {
    try {
      const res = await sendMessage<{ opened: boolean }>({
        type: 'sidePanel.open',
        payload: { tabId: activeTab?.tabId },
        requestId: `sp-${Date.now()}`,
      })
      // 指定了非默认路由才写入待跳转路由(sidepanel 启动时检测);
      // 不传 route 时保留 sidepanel 当前路由
      if (res?.opened && route && route !== '/chat') {
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
    const url = 'https://www.aizhs.top/'
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
            // 本表面没传 enableCredentialPersistence(默认 false)⇒ 组件里的自动提交分支
            // 结构上不会执行,这里给显式 true 只是把"扩展弹窗没有登出标记"这件事写出来,
            // 而不是留一个看不见的缺省。web 那侧的写法才是判据的正解。
            canAutoSubmitCredentials={() => true}
            thirdParty={thirdParty.config}
            tabs={loginPlan.plan.tabs}
            thirdPartyFeaturedPlatform={loginPlan.plan.featuredPlatform}
            thirdPartyFeaturedBackground={loginPlan.featuredBackground}
            thirdPartyPriorityPlatforms={loginPlan.plan.priorityPlatforms}
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
        <div className="flex items-center gap-2.5 py-2 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-cta text-cta-foreground flex items-center justify-center text-base font-semibold shrink-0">
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
            icon={MessageCircle}
            onClick={() => openSidePanel('/chat')}
            variant="primary"
          />
          <QuickActionButton
            label={t('popup.openSidePanel')}
            icon={MapPin}
            onClick={() => openSidePanel()}
          />
          <QuickActionButton
            label={t('nav.vocabulary')}
            icon={BookOpen}
            onClick={() => openSidePanel('/vocabulary')}
          />
          <QuickActionButton
            label={t('nav.profile')}
            icon={User}
            onClick={() => openSidePanel('/profile')}
          />
          <QuickActionButton
            label={t('nav.wallet')}
            icon={Wallet}
            onClick={() => openSidePanel('/wallet')}
          />
          <QuickActionButton
            label={copyHint || (activeTab?.url ? `${t('popup.copySuccess')} URL` : '—')}
            icon={LinkIcon}
            onClick={copyPageUrl}
            disabled={!activeTab?.url}
          />
          <QuickActionButton
            label={t('popup.openWeb')}
            icon={Globe}
            onClick={openWeb}
            variant="default"
          />
        </div>
      </div>
      <button
        type="button"
        className="bg-card text-destructive border border-destructive rounded-sm px-3.5 py-2 text-[13px] cursor-pointer hover:bg-destructive/10"
        onClick={onLogout}
      >
        {t('auth.logout')}
      </button>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
