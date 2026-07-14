'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui'

import { useThirdPartyAuth, fetchGoogleOAuthConfig } from '@/hooks/use-third-party-auth'
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
  React.useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const platformParam = searchParams.get('platform')
    if (!code || !state) return

    // 仅在明确带 platform 参数、或路径匹配已知回调时处理
    const knownPlatforms: ThirdPartyPlatform[] = [
      'google',
      'apple',
      'dingtalk',
      'enterpriseWechat',
      'wechat',
      'github',
      'feishu',
    ]
    const platform =
      platformParam && knownPlatforms.includes(platformParam as ThirdPartyPlatform)
        ? (platformParam as ThirdPartyPlatform)
        : null
    if (!platform) return

    setHandlingCallback(true)
    void handleCallback(platform, code, state).finally(() => setHandlingCallback(false))
  }, [searchParams, handleCallback])

  const providers: Provider[] = [
    {
      key: 'google',
      label: t('googleLogin'),
      icon: '/images/oauth-providers/google.svg',
      needsBackendConfig: true,
    },
    { key: 'apple', label: t('appleLogin'), icon: '/images/oauth-providers/apple.svg', mono: true },
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
  ]

  const handleProviderClick = (platform: ThirdPartyPlatform) => {
    void startLogin(platform)
  }

  return (
    <>
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t('thirdPartyLogin')}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {providers.map((p) => {
          const googleDisabled = p.needsBackendConfig && googleConfigured === false
          const platformDisabled = !isPlatformEnabled(p.key)
          const disabled = googleDisabled || platformDisabled || handlingCallback
          const isBusy = isLoading && currentPlatform === p.key
          return (
            <Button
              key={p.key}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => handleProviderClick(p.key)}
              title={
                googleDisabled
                  ? t('googleNotConfigured')
                  : platformDisabled
                    ? t('googleNotConfigured')
                    : undefined
              }
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.icon}
                  alt=""
                  aria-hidden="true"
                  className={cn('h-4 w-4 shrink-0', p.mono && 'dark:invert')}
                />
              )}
              <span>{p.label}</span>
            </Button>
          )
        })}
      </div>
    </>
  )
}
