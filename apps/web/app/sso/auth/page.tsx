'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, ShieldCheck } from 'lucide-react'

import { useThirdPartyAuth } from '@/hooks/use-third-party-auth'
import { isAuthSubdomainHost, buildMainDomainUrl } from '@/lib/auth-domains'
import type { ThirdPartyPlatform } from '@/types/third-party'

/** 认证子域 bsm.aizhs.top/sso/auth 薄页 (2026-07-21 立)
 *
 * 分域 SSO 跳板:
 * - 入口:主域点第三方登录 → 302 到 bsm.aizhs.top/sso/auth?platform=xxx&return_to=...
 * - 行为:挂载时自动调用 startLogin(platform) 发起 OAuth
 *   (此时已在认证子域,startLogin 走原厂商跳转流程,redirect_uri = bsm.aizhs.top/callback)
 * - 回跳:厂商回调到 bsm.aizhs.top/callback → OAuthCallbackHandler 写跨域 Cookie + 307 跳 return_to
 *
 * 安全:
 * - 必须在认证子域内才执行,主域直访 → 立即 307 跳回主域,避免被独立部署滥用
 * - 缺少 platform 参数 → 跳回主域根路径
 */

const KNOWN_PLATFORMS: ThirdPartyPlatform[] = [
  'google',
  'apple',
  'dingtalk',
  'enterpriseWechat',
  'wechat',
  'github',
  'feishu',
  'alipay',
]

function isKnownPlatform(p: string | null): p is ThirdPartyPlatform {
  return !!p && (KNOWN_PLATFORMS as string[]).includes(p)
}

export default function SsoAuthPage() {
  const t = useTranslations('sso')
  const searchParams = useSearchParams()
  const { startLogin } = useThirdPartyAuth()
  const [error, setError] = React.useState<string | null>(null)
  const triggeredRef = React.useRef(false)

  const platform = searchParams.get('platform')
  const returnTo = searchParams.get('return_to')

  React.useEffect(() => {
    // 防重复触发(React 18 StrictMode 双重挂载)
    if (triggeredRef.current) return
    triggeredRef.current = true

    // 安全:不在认证子域 → 跳回主域
    if (!isAuthSubdomainHost()) {
      window.location.href = buildMainDomainUrl('/')
      return
    }

    if (!isKnownPlatform(platform)) {
      setError(t('invalidPlatform'))
      // 3 秒后跳回主域,避免用户卡在错误页
      setTimeout(() => {
        window.location.href = buildMainDomainUrl('/')
      }, 3000)
      return
    }

    void startLogin(platform)
  }, [platform, returnTo, startLogin, t])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <h1 className="mb-1 text-base font-semibold">{t('authFailed')}</h1>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
        <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
        <h1 className="mb-1 text-base font-semibold">{t('redirecting')}</h1>
        <p className="text-xs text-muted-foreground">{t('redirectingDesc', { platform })}</p>
      </div>
    </div>
  )
}
