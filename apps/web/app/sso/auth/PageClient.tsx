// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, ShieldCheck } from 'lucide-react'
import { AgreementCheckbox, Button } from '@ihui/ui-react'

import { useThirdPartyAuth } from '@/hooks/use-third-party-auth'
import { isAuthSubdomainHost, buildMainDomainUrl } from '@/lib/auth-domains'
import type { ThirdPartyPlatform } from '@/types/third-party'

/** 认证子域 bsm.aizhs.top/sso/auth 薄页 (2026-07-21 立)
 *
 * 分域 SSO 跳板:
 * - 入口:主域点第三方登录 → 302 到 bsm.aizhs.top/sso/auth?platform=xxx&return_to=...
 * - 行为:**先展示协议同意步骤**,用户勾选并点「授权并跳转」后才调用
 *   startLogin(platform, true) 发起 OAuth(此时已在认证子域,startLogin 走原厂商跳转流程,
 *   redirect_uri = bsm.aizhs.top/callback)
 * - 回跳:厂商回调到 bsm.aizhs.top/callback → OAuthCallbackHandler 写跨域 Cookie + 307 跳 return_to
 *
 * 2026-10-27:服务端通用 OAuth 回调改为 fail-closed(要求发起期已落同意记录,绑定 state),
 * 本页原先"挂载即 startLogin"会在新闸上线后必断,故改为显式同意步骤。
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
  const tAuth = useTranslations('auth')
  const searchParams = useSearchParams()
  const { startLogin } = useThirdPartyAuth()
  const [error, setError] = React.useState<string | null>(null)
  const [agreed, setAgreed] = React.useState(false)
  const [showAgreeErr, setShowAgreeErr] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const triggeredRef = React.useRef(false)

  const platform = searchParams.get('platform')

  React.useEffect(() => {
    // 防重复触发(React 18 StrictMode 双重挂载)
    if (triggeredRef.current) return
    triggeredRef.current = true

    // 安全:非认证子域且非 localhost → 跳回主域
    // - 认证子域(bsm.aizhs.top):正常执行 OAuth 跳板逻辑
    // - localhost / 127.0.0.1:本地开发,直接走 OAuth(避免被跳到生产主域 aizhs.top)
    // - 主域 / 其他 host:/sso/auth 应只在认证子域访问,跳回主域根防滥用
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    if (!isAuthSubdomainHost() && !isLocalhost) {
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
    // 2026-10-27:不再挂载即 startLogin —— 先让用户显式同意,点按钮后才发起
  }, [platform, t])

  /** 同意并继续:未勾选只提示,不跳转;已勾选才带 agreementAccepted=true 发起 OAuth */
  const handleContinue = React.useCallback(async () => {
    if (!isKnownPlatform(platform)) return
    if (!agreed) {
      setShowAgreeErr(true)
      return
    }
    setStarting(true)
    const ok = await startLogin(platform, true)
    if (!ok) {
      setStarting(false)
      setError(t('authFailed'))
    }
  }, [agreed, platform, startLogin, t])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-3">
        <div className="w-full max-w-sm rounded-lg border bg-card p-3 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <h1 className="mb-1 text-base font-semibold">{t('authFailed')}</h1>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border bg-card p-3 text-center shadow-sm">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h1 className="mb-1 text-base font-semibold">{t('title')}</h1>
        <p className="mb-3 text-xs text-muted-foreground">
          {t('redirectingDesc', { platform: platform ?? '' })}
        </p>
        {/* 2026-10-27:发起期同意是服务端回调闸的唯一凭据,必须先勾选再点按钮 */}
        <div className="text-left">
          <AgreementCheckbox
            t={tAuth}
            checked={agreed}
            onChange={(v) => {
              setAgreed(v)
              if (v) setShowAgreeErr(false)
            }}
            error={showAgreeErr && !agreed}
          />
          {showAgreeErr && !agreed && (
            <p className="mt-1 text-xs text-destructive">{t('mustAgree')}</p>
          )}
        </div>
        <Button
          type="button"
          className="mt-3 w-full"
          disabled={starting}
          onClick={() => {
            void handleContinue()
          }}
        >
          {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t('authorizeAndRedirect')}
        </Button>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
