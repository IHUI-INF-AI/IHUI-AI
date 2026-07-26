/**
 * useExtensionThirdPartyAuth(2026-07-26 立)
 *
 * 扩展端第三方登录(8 平台)配置 hook,注入到共享 @ihui/ui-react.LoginForm。
 * 平台策略:点击跳 web 端 https://www.ihui.ai/signin?from=extension&platform=xxx,
 * web 端完成 OAuth 回调,token 写 chrome.storage(通过 web → 扩展跨域方案)。
 *
 * 视觉规范(对标 web 端 ThirdPartyLoginButtons.tsx):
 *   - 8 平台顺序:wechat / google / github / feishu / dingtalk / enterpriseWechat / alipay / apple
 *   - 图标:内联 SVG(16x16 stroke 风格,扩展端不依赖 oauth-providers/*.svg / lucide-react)
 *   - apple:forceDisabled=true + disabledTooltip=auth.appleComingSoon(未上线)
 *
 * 与 web 端差异:
 *   - 扩展端不嵌 OAuth SDK,统一跳 web 完成 → 简化跨域 / popup blocker / iframe 限制
 *   - 关闭 popup 后 state 自动 GC,setTimeout 200ms 仅为避免 loading 闪烁
 *   - 图标采用语义化内联 SVG,无第三方图标库依赖,保持扩展端包体精简
 */
import * as React from 'react'
import {
  ALL_THIRD_PARTY_PLATFORMS,
  type ThirdPartyConfig,
  type ThirdPartyPlatform,
  type ThirdPartyProvider,
} from '@ihui/ui-react'

import { useI18n } from '../i18n'

/** web 端 OAuth 入口(带 from=extension 标识 + platform 区分) */
const WEB_SIGNIN_URL = 'https://www.ihui.ai/signin'

/** 8 平台 i18n label key 映射(与共享 packages/i18n/messages/shared/*.json auth.* 命名空间对齐) */
const LABEL_KEYS: Record<ThirdPartyPlatform, string> = {
  wechat: 'auth.wechatLogin',
  google: 'auth.googleLogin',
  github: 'auth.githubLogin',
  feishu: 'auth.feishuLogin',
  dingtalk: 'auth.dingtalkLogin',
  enterpriseWechat: 'auth.enterpriseWechat',
  alipay: 'auth.alipayLogin',
  apple: 'auth.appleLogin',
}

/** apple 未上线,强制禁用 */
function isPlatformForceDisabled(platform: ThirdPartyPlatform): boolean {
  return platform === 'apple'
}

/** 跳 web 端 OAuth:扩展环境用 chrome.tabs.create,普通 web 环境用 window.open */
function openWebOAuth(platform: ThirdPartyPlatform): void {
  const url = `${WEB_SIGNIN_URL}?from=extension&platform=${platform}`
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url })
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * 8 平台内联 SVG 图标(16x16 viewBox,currentColor stroke,语义化)。
 * 注:为避免新增 lucide-react 依赖(扩展端 package.json 暂无),全部内联实现,
 * 视觉上与 lucide-react 同尺寸图标等价(线宽 1.5,描边色 currentColor)。
 */
function PlatformIcon({ platform }: { platform: ThirdPartyPlatform }): React.ReactNode {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (platform) {
    case 'wechat':
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      )
    case 'google':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
    case 'github':
      return (
        <svg {...common}>
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      )
    case 'feishu':
      return (
        <svg {...common}>
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
        </svg>
      )
    case 'dingtalk':
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="14" rx="2" />
          <path d="M2 10h20M6 6V3h12v3M12 14v3" />
        </svg>
      )
    case 'enterpriseWechat':
      return (
        <svg {...common}>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M9 5h6M9 18h6M12 18v2" />
        </svg>
      )
    case 'alipay':
      return (
        <svg {...common}>
          <path d="M20 12V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" />
          <path d="M16 12H8M16 16l-4-4M20 16v3a2 2 0 0 1-2 2h-3" />
        </svg>
      )
    case 'apple':
      return (
        <svg {...common}>
          <path d="M9 7c-.5-1.5.5-3 1.5-3.5C10.8 4 12 5 12 5s1.2-1 1.5-1.5C14.5 4 15.5 5.5 15 7c-.4 1.2-1.5 2-3 2s-2.6-.8-3-2z" />
          <path d="M12 9c-3 0-5 2-5 5 0 3 2 7 5 7s5-4 5-7c0-3-2-5-5-5z" />
        </svg>
      )
  }
}

export function useExtensionThirdPartyAuth(): {
  config: ThirdPartyConfig
  startLogin: (platform: ThirdPartyPlatform) => void
} {
  const { t } = useI18n()
  const [currentPlatform, setCurrentPlatform] = React.useState<ThirdPartyPlatform | null>(null)

  const startLogin = React.useCallback((platform: ThirdPartyPlatform) => {
    setCurrentPlatform(platform)
    try {
      openWebOAuth(platform)
    } finally {
      // 关闭 popup 后 state 会被 GC,延迟 200ms 避免 loading 闪烁
      setTimeout(() => setCurrentPlatform((cur) => (cur === platform ? null : cur)), 200)
    }
  }, [])

  const providers: ThirdPartyProvider[] = React.useMemo(
    () =>
      ALL_THIRD_PARTY_PLATFORMS.map((key) => {
        const forceDisabled = isPlatformForceDisabled(key)
        return {
          key,
          label: t(LABEL_KEYS[key]),
          icon: <PlatformIcon platform={key} />,
          enabled: !forceDisabled,
          forceDisabled,
          mono: key === 'github' || key === 'apple',
          disabledTooltip: forceDisabled ? t('auth.appleComingSoon') : undefined,
        }
      }),
    [t],
  )

  const config: ThirdPartyConfig = React.useMemo(
    () => ({
      providers,
      currentPlatform,
      onLogin: startLogin,
    }),
    [providers, currentPlatform, startLogin],
  )

  return { config, startLogin }
}
