'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Loader2, KeyRound, MessageCircle, Globe, Send } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { useThirdPartyAuth } from '@/hooks/use-third-party-auth'
import { useAuthStore } from '@/stores/auth'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import type { ThirdPartyPlatform } from '@/types/third-party'

type Provider = {
  key: ThirdPartyPlatform
  label: string
  icon: string
  /** 单色图标：dark 模式下用 invert 翻色保证可见 */
  mono?: boolean
  /** 强制禁用（始终不可用，如 Apple 登录尚未上线） */
  forceDisabled?: boolean
}

/**
 * 4 个新社交登录 provider 类型(OIDC + Discord + LinuxDO + Telegram)。
 * 独立于 ThirdPartyPlatform(该类型不在本任务清单,无法扩展),
 * 因此 4 个新按钮不走 useThirdPartyAuth hook,直接调后端 /api/auth/oauth/<provider>/* 端点。
 */
type ExtraProviderKey = 'oidc' | 'discord' | 'linuxdo' | 'telegram'

type ExtraProvider = {
  key: ExtraProviderKey
  label: string
  icon: React.ReactNode
}

/** 4 个新社交登录 provider 配置(图标用 lucide-react 现有图标,避免引入新 SVG 文件) */
const EXTRA_PROVIDERS: ExtraProvider[] = [
  { key: 'oidc', label: '企业 SSO', icon: <KeyRound className="h-4 w-4 shrink-0" /> },
  { key: 'discord', label: 'Discord', icon: <MessageCircle className="h-4 w-4 shrink-0" /> },
  { key: 'linuxdo', label: 'LinuxDO', icon: <Globe className="h-4 w-4 shrink-0" /> },
  { key: 'telegram', label: 'Telegram', icon: <Send className="h-4 w-4 shrink-0" /> },
]

/**
 * 第三方登录按钮群（3 列网格布局，按行排列）：
 * 第一排：微信 / Google / GitHub
 * 第二排：飞书 / 钉钉 / 企业微信
 * 第三排：支付宝 / Apple
 *
 * 增强点（相比旧实现）：
 * - 通过 useThirdPartyAuth hook 统一管理登录状态，替代硬编码 window.location.href 跳转。
 * - 每次 OAuth 跳转生成随机 state 并存入 sessionStorage，回调时校验，防止 CSRF。
 * - 支持回调处理：当 URL 含 code/state 时自动触发对应平台的回调流程。
 * - 演示模式 / 后端失败时自动回退为本地数据，保证登录链路可用。
 */
function ThirdPartyLoginButtonsInner() {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const { startLogin, handleCallback, isPlatformEnabled, isLoading, currentPlatform } =
    useThirdPartyAuth()

  // 回调处理中
  const [handlingCallback, setHandlingCallback] = React.useState(false)

  // ===== 4 个新社交登录(OIDC + Discord + LinuxDO + Telegram)状态 =====
  const [extraLoading, setExtraLoading] = React.useState<ExtraProviderKey | null>(null)
  const [telegramWaiting, setTelegramWaiting] = React.useState<{
    authToken: string
    expiresAt: number
  } | null>(null)
  const telegramPollingRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const telegramTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Telegram 轮询:每 3s 调 verify,成功则写入 auth store + reload,超时则清理
  const startTelegramPolling = React.useCallback((authToken: string, ttlMs: number) => {
    // 清理之前的轮询
    if (telegramPollingRef.current) clearInterval(telegramPollingRef.current)
    if (telegramTimeoutRef.current) clearTimeout(telegramTimeoutRef.current)

    const poll = async () => {
      try {
        const res = await fetch('/api/auth/oauth/telegram/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authToken }),
        })
        const json = (await res.json()) as {
          code: number
          data?: {
            status: 'pending' | 'success'
            token?: string
            refreshToken?: string
            userId?: string
          }
        }
        if (json.code === 200 && json.data?.status === 'success' && json.data.token) {
          // 登录成功:写入 auth store(zustand persist 自动持久化到 localStorage)+ reload
          if (telegramPollingRef.current) clearInterval(telegramPollingRef.current)
          if (telegramTimeoutRef.current) clearTimeout(telegramTimeoutRef.current)
          const { setToken } = useAuthStore.getState()
          setToken(json.data.token, json.data.refreshToken)
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
        }
        // status === 'pending' → 继续轮询(不做事)
      } catch {
        // 单次网络失败忽略,继续轮询
      }
    }

    void poll()
    telegramPollingRef.current = setInterval(poll, 3000)
    telegramTimeoutRef.current = setTimeout(() => {
      if (telegramPollingRef.current) clearInterval(telegramPollingRef.current)
      setTelegramWaiting(null)
      setExtraLoading(null)
    }, ttlMs)
  }, [])

  // Telegram 登录:start → 拿 deeplink → 新窗口打开 → 启动轮询
  const handleTelegramClick = React.useCallback(async () => {
    if (telegramWaiting) return // 防重复点击
    setExtraLoading('telegram')
    try {
      const res = await fetch('/api/auth/oauth/telegram/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = (await res.json()) as {
        code: number
        data?: { botAuthUrl: string; authToken: string; expiresIn: number }
        message?: string
      }
      if (json.code !== 200 || !json.data) {
        throw new Error(json.message ?? 'Telegram 启动失败')
      }
      const { botAuthUrl, authToken, expiresIn } = json.data
      setTelegramWaiting({ authToken, expiresAt: Date.now() + expiresIn * 1000 })
      // 在新窗口/新标签打开 Telegram deeplink(PC 端唤起 Telegram 客户端,移动端跳 t.me)
      if (typeof window !== 'undefined') {
        window.open(botAuthUrl, '_blank', 'noopener,noreferrer')
      }
      // 启动轮询(ttl 对齐 authToken 5min 有效期)
      startTelegramPolling(authToken, expiresIn * 1000)
    } catch (e) {
      console.error('Telegram 登录启动失败:', e)
      setExtraLoading(null)
    }
  }, [startTelegramPolling, telegramWaiting])

  // 4 个新 provider 点击入口
  const handleExtraClick = React.useCallback(
    async (provider: ExtraProviderKey) => {
      if (extraLoading) return // 防重复点击
      if (provider === 'telegram') {
        await handleTelegramClick()
        return
      }
      // OIDC/Discord/LinuxDO:直接跳转到后端 redirect 端点(后端 302 到 provider 授权页)
      setExtraLoading(provider)
      if (typeof window !== 'undefined') {
        window.location.href = `/api/auth/oauth/${provider}/redirect`
      }
    },
    [extraLoading, handleTelegramClick],
  )

  // 组件卸载时清理 Telegram 轮询
  React.useEffect(() => {
    return () => {
      if (telegramPollingRef.current) clearInterval(telegramPollingRef.current)
      if (telegramTimeoutRef.current) clearTimeout(telegramTimeoutRef.current)
    }
  }, [])

  // 自动处理 OAuth 回调：URL 含 code + state 时触发
  // ⚠️ /callback 路径下跳过,避免与 OAuthCallbackHandler 双重处理导致 state 校验失败 (2026-07-21 修)
  // /callback 路由由 OAuthCallbackHandler 官方处理(直接 fetchApi,不校验 state)
  // 本逻辑仅用于"弹窗内 OAuth 回调"场景(如 LoginDialog 中点登录后 URL 带 code/state)
  React.useEffect(() => {
    // /callback 路径下不处理,交给 OAuthCallbackHandler
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      if (path === '/callback' || path.startsWith('/callback/')) return
      if (path === '/google/callback' || path === '/apple/callback') return
    }

    const code = searchParams.get('code')
    const authCode = searchParams.get('auth_code')
    const state = searchParams.get('state')
    const platformParam = searchParams.get('platform')
    if (!state) return
    if (!code && !authCode) return

    // 仅在明确带 platform 参数、或路径匹配已知回调时处理
    const knownPlatforms: ThirdPartyPlatform[] = [
      'google',
      'apple',
      'dingtalk',
      'enterpriseWechat',
      'wechat',
      'github',
      'feishu',
      'alipay',
    ]
    const platform =
      platformParam && knownPlatforms.includes(platformParam as ThirdPartyPlatform)
        ? (platformParam as ThirdPartyPlatform)
        : null
    if (!platform) return

    // 支付宝使用 auth_code 参数（其他平台使用 code）
    const finalCode = platform === 'alipay' ? authCode : code
    if (!finalCode) return

    setHandlingCallback(true)
    void handleCallback(platform, finalCode, state).finally(() => setHandlingCallback(false))
  }, [searchParams, handleCallback])

  // 排列顺序：3 列网格按行铺排
  // 第一排：微信 / Google / GitHub
  // 第二排：飞书 / 钉钉 / 企业微信
  // 第三排：支付宝 / Apple
  const providers: Provider[] = [
    // 第一排
    { key: 'wechat', label: t('wechatLogin'), icon: '/images/oauth-providers/wechat.svg' },
    {
      key: 'google',
      label: t('googleLogin'),
      icon: '/images/oauth-providers/google.svg',
    },
    {
      key: 'github',
      label: t('githubLogin'),
      icon: '/images/oauth-providers/github.svg',
      mono: true,
    },
    // 第二排
    { key: 'feishu', label: t('feishuLogin'), icon: '/images/loginSANFANG/feishu.png' },
    { key: 'dingtalk', label: t('dingtalkLogin'), icon: '/images/oauth-providers/dingtalk.svg' },
    {
      key: 'enterpriseWechat',
      label: t('enterpriseWechat'),
      icon: '/images/oauth-providers/wecom.svg',
    },
    // 第三排
    { key: 'alipay', label: t('alipayLogin'), icon: '/images/oauth-providers/alipay.svg' },
    {
      key: 'apple',
      label: t('appleLogin'),
      icon: '/images/oauth-providers/apple.svg',
      mono: true,
      forceDisabled: true,
    },
  ]

  const handleProviderClick = (platform: ThirdPartyPlatform) => {
    void startLogin(platform)
  }

  return (
    <>
      <div className="mt-3 mb-4 flex justify-center text-xs uppercase">
        <span className="text-muted-foreground">{t('thirdPartyLogin')}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {providers.map((p) => {
          const platformDisabled = !isPlatformEnabled(p.key)
          const disabled = p.forceDisabled || platformDisabled || handlingCallback
          const isBusy = isLoading && currentPlatform === p.key
          const tooltipContent = p.forceDisabled
            ? t('appleComingSoon')
            : platformDisabled
              ? t('googleNotConfigured')
              : undefined
          const button = (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => handleProviderClick(p.key)}
              className={cn(p.forceDisabled && 'grayscale opacity-50')}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Image
                  src={p.icon}
                  alt=""
                  aria-hidden="true"
                  width={16}
                  height={16}
                  className={cn('h-4 w-4 shrink-0', p.mono && 'dark:invert')}
                />
              )}
              <span>{p.label}</span>
            </Button>
          )
          return tooltipContent ? (
            <Tooltip key={p.key} content={tooltipContent}>
              {button}
            </Tooltip>
          ) : (
            <React.Fragment key={p.key}>{button}</React.Fragment>
          )
        })}
      </div>

      {/* 4 个新社交登录按钮(OIDC + Discord + LinuxDO + Telegram) */}
      {/* 独立 grid,不走 useThirdPartyAuth(ThirdPartyPlatform 类型未扩展) */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {EXTRA_PROVIDERS.map((p) => {
          const isBusy = extraLoading === p.key
          const disabled = Boolean(extraLoading) || handlingCallback
          return (
            <Button
              key={p.key}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => handleExtraClick(p.key)}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : p.icon}
              <span>{p.label}</span>
            </Button>
          )
        })}
      </div>
      {telegramWaiting && (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          请在 Telegram 中点击发送给 Bot 的链接完成登录,正在等待验证…
        </div>
      )}
    </>
  )
}

/**
 * Suspense 包裹的第三方登录按钮群(2026-07-24 A 套壳适配)
 * output:'export' 模式要求 useSearchParams() 被 <Suspense> 边界包裹
 */
export function ThirdPartyLoginButtons() {
  return (
    <React.Suspense fallback={null}>
      <ThirdPartyLoginButtonsInner />
    </React.Suspense>
  )
}
