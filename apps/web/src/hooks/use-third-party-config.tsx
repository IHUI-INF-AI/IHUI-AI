'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

import { useThirdPartyAuth } from './use-third-party-auth'
import type {
  ThirdPartyConfig,
  ThirdPartyPlatform,
  ThirdPartyProvider,
} from '@ihui/ui-react'

/**
 * 8 平台 provider 静态定义(对标 web 端 ThirdPartyLoginButtons.tsx 3x3 网格铺排)
 * 顺序:微信/Google/GitHub → 飞书/钉钉/企业微信 → 支付宝/Apple
 */
const PROVIDER_DEFS: ReadonlyArray<{
  key: ThirdPartyPlatform
  labelKey: string
  icon: string
  mono?: boolean
  forceDisabled?: boolean
}> = [
  { key: 'wechat', labelKey: 'wechatLogin', icon: '/images/oauth-providers/wechat.svg' },
  { key: 'google', labelKey: 'googleLogin', icon: '/images/oauth-providers/google.svg' },
  { key: 'github', labelKey: 'githubLogin', icon: '/images/oauth-providers/github.svg', mono: true },
  { key: 'feishu', labelKey: 'feishuLogin', icon: '/images/loginSANFANG/feishu.png' },
  { key: 'dingtalk', labelKey: 'dingtalkLogin', icon: '/images/oauth-providers/dingtalk.svg' },
  {
    key: 'enterpriseWechat',
    labelKey: 'enterpriseWechat',
    icon: '/images/oauth-providers/wecom.svg',
  },
  { key: 'alipay', labelKey: 'alipayLogin', icon: '/images/oauth-providers/alipay.svg' },
  {
    key: 'apple',
    labelKey: 'appleLogin',
    icon: '/images/oauth-providers/apple.svg',
    mono: true,
    forceDisabled: true,
  },
]

/** URL 回调识别的 8 平台列表(与 useThirdPartyAuth.handleCallback 入参对齐) */
const KNOWN_CALLBACK_PLATFORMS: readonly ThirdPartyPlatform[] = [
  'google',
  'apple',
  'dingtalk',
  'enterpriseWechat',
  'wechat',
  'github',
  'feishu',
  'alipay',
]

/**
 * 把 useThirdPartyAuth 适配成共享 ThirdPartyConfig(给 LoginForm 注入)
 *
 * 关键职责(2026-07-26 立):
 * 1. 构造 8 平台的 ThirdPartyProvider[] (label/icon/enabled/forceDisabled/mono)
 * 2. URL OAuth 回调处理:code+state+platform → useThirdPartyAuth.handleCallback
 *    (从原 local ThirdPartyLoginButtons 移过来,保留 OAuth 跳转 + state 校验 + 回调链路)
 * 3. 暴露 currentPlatform + onLogin 给共享 ThirdPartyLoginButtons
 *
 * 共享包关键差异(2026-07-26):
 *   - 共享 ThirdPartyLoginButtons 不感知 useSearchParams / 也不做 URL 回调
 *   - 共享组件从 config.currentPlatform 派生 loading,callback 处理必须由调用方完成
 *   - i18n 通过 t() 注入,本 hook 走 useTranslations('auth')(next-intl)
 */
export function useThirdPartyConfig(): ThirdPartyConfig {
  const t = useTranslations('auth')
  const { startLogin, handleCallback, isPlatformEnabled, currentPlatform } =
    useThirdPartyAuth()

  // URL OAuth 回调处理(从原 local ThirdPartyLoginButtons.tsx 移过来)
  // ⚠️ /callback 路径下跳过,避免与 OAuthCallbackHandler 双重处理导致 state 校验失败
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const path = window.location.pathname
    if (path === '/callback' || path.startsWith('/callback/')) return
    if (path === '/google/callback' || path === '/apple/callback') return

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const authCode = params.get('auth_code')
    const state = params.get('state')
    const platformParam = params.get('platform')
    if (!state) return
    if (!code && !authCode) return

    const platform =
      platformParam && (KNOWN_CALLBACK_PLATFORMS as readonly string[]).includes(platformParam)
        ? (platformParam as ThirdPartyPlatform)
        : null
    if (!platform) return

    // 支付宝用 auth_code 参数(其他平台用 code)
    const finalCode = platform === 'alipay' ? authCode : code
    if (!finalCode) return

    void handleCallback(platform, finalCode, state)
  }, [handleCallback])

  const providers: ThirdPartyProvider[] = React.useMemo(
    () =>
      PROVIDER_DEFS.map((def) => ({
        key: def.key,
        label: t(def.labelKey as 'wechatLogin'),
        icon: (
          <Image
            src={def.icon}
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
            className={`h-4 w-4 shrink-0 ${def.mono ? 'dark:invert' : ''}`}
            unoptimized
          />
        ),
        enabled: !def.forceDisabled && isPlatformEnabled(def.key),
        forceDisabled: def.forceDisabled,
        mono: def.mono,
      })),
    [t, isPlatformEnabled],
  )

  return React.useMemo<ThirdPartyConfig>(
    () => ({
      providers,
      currentPlatform,
      onLogin: (p) => {
        void startLogin(p)
      },
    }),
    [providers, currentPlatform, startLogin],
  )
}
