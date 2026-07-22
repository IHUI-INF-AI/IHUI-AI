'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui'

import { useThirdPartyAuth, fetchGoogleOAuthConfig } from '@/hooks/use-third-party-auth'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import type { ThirdPartyPlatform } from '@/types/third-party'

type Provider = {
  key: ThirdPartyPlatform
  label: string
  icon: string
  /** 单色图标：dark 模式下用 invert 翻色保证可见 */
  mono?: boolean
  /** 未配置时禁用（仅 google 需要后端配置探测） */
  needsBackendConfig?: boolean
  /** 强制禁用（始终不可用，如 Apple 登录尚未上线） */
  forceDisabled?: boolean
}

/**
 * 第三方登录按钮群：Google / Apple / 钉钉 / 企业微信 / 微信 / GitHub。
 *
 * 增强点（相比旧实现）：
 * - 通过 useThirdPartyAuth hook 统一管理登录状态，替代硬编码 window.location.href 跳转。
 * - 每次 OAuth 跳转生成随机 state 并存入 sessionStorage，回调时校验，防止 CSRF。
 * - 支持回调处理：当 URL 含 code/state 时自动触发对应平台的回调流程。
 * - 演示模式 / 后端失败时自动回退为本地数据，保证登录链路可用。
 */
export function ThirdPartyLoginButtons() {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const { startLogin, handleCallback, isPlatformEnabled, isLoading, currentPlatform } =
    useThirdPartyAuth()

  // Google 登录是否已在后端配置
  const [googleConfigured, setGoogleConfigured] = React.useState<boolean | null>(null)
  // 回调处理中
  const [handlingCallback, setHandlingCallback] = React.useState(false)

  // 探测 Google 后端配置
  React.useEffect(() => {
    let active = true
    void fetchGoogleOAuthConfig()
      .then((cfg) => {
        if (active) setGoogleConfigured(cfg ? cfg.configured : false)
      })
      .catch(() => active && setGoogleConfigured(false))
    return () => {
      active = false
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

  const providers: Provider[] = [
    {
      key: 'google',
      label: t('googleLogin'),
      icon: '/images/oauth-providers/google.svg',
      needsBackendConfig: true,
    },
    { key: 'dingtalk', label: t('dingtalkLogin'), icon: '/images/oauth-providers/dingtalk.svg' },
    {
      key: 'enterpriseWechat',
      label: t('enterpriseWechat'),
      icon: '/images/oauth-providers/wecom.svg',
    },
    { key: 'wechat', label: t('wechatLogin'), icon: '/images/oauth-providers/wechat.svg' },
    {
      key: 'github',
      label: t('githubLogin'),
      icon: '/images/oauth-providers/github.svg',
      mono: true,
    },
    { key: 'feishu', label: t('feishuLogin'), icon: '/images/loginSANFANG/feishu.png' },
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
          const googleDisabled = p.needsBackendConfig && googleConfigured === false
          const platformDisabled = !isPlatformEnabled(p.key)
          const disabled = p.forceDisabled || googleDisabled || platformDisabled || handlingCallback
          const isBusy = isLoading && currentPlatform === p.key
          const tooltipContent = p.forceDisabled
            ? t('appleComingSoon')
            : googleDisabled || platformDisabled
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
    </>
  )
}
