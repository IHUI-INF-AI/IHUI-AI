'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { buildMainDomainUrl, isAuthSubdomainHost } from '@/lib/auth-domains'

type Status = 'loading' | 'success' | 'error'

interface OAuthCallbackHandlerProps {
  provider: 'generic' | 'google' | 'apple'
}

/**
 * 构造后端回调端点路径。
 * - google / apple 有独立端点(历史遗留)
 * - generic 平台从 URL ?platform=xxx 读取,调用 /api/auth/{platform}/callback
 *   后端 /auth/:platform/callback 支持:dingtalk / enterpriseWechat / wechat / feishu / github / alipay
 */
function buildApiPath(provider: OAuthCallbackHandlerProps['provider'], platformParam: string | null): string | null {
  if (provider === 'google') return '/api/auth/google/callback'
  if (provider === 'apple') return '/api/auth/apple/callback'
  // generic:必须从 URL 读 platform 参数
  if (!platformParam) return null
  return `/api/auth/${platformParam}/callback`
}

function OAuthCallbackHandlerInner({ provider }: OAuthCallbackHandlerProps) {
  const router = useRouter()
  const params = useSearchParams()
  const t = useTranslations('oAuthCallbackPage')
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const [status, setStatus] = React.useState<Status>('loading')
  const [errorMsg, setErrorMsg] = React.useState<string>('')

  React.useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    const platformParam = params.get('platform')

    const apiPath = buildApiPath(provider, platformParam)

    if (!apiPath) {
      setStatus('error')
      setErrorMsg(t('error.missingPlatform'))
      return
    }

    if (!code) {
      setStatus('error')
      setErrorMsg(t('error.missingCode'))
      return
    }

    // 🎭 Mock 授权识别:code 以 mock_ 开头时,本地直接构造登录态,跳过后端 API
    // 配合 /oauth/mock/[platform] 本地授权页使用,完整模拟真实 OAuth 流程
    if (code.startsWith('mock_')) {
      const mockUserId = `mock_${platformParam ?? 'user'}_${Date.now()}`
      const mockToken = `mock_token_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      const displayName = platformParam ? `${platformParam}演示用户` : '演示用户'
      const mockUser = {
        id: mockUserId,
        nickname: displayName,
        email: `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`,
        avatar: null,
        provider: platformParam ?? 'mock',
      } as never
      setToken(mockToken, `mock_refresh_${Date.now()}`)
      setUser(mockUser)
      // 分域 SSO (2026-07-21): mock 模式下,user 信息无法靠 zustand persist 跨子域传递
      // (localStorage per-domain),所以单独写一个跨域 cookie 让主域 bootstrap 能恢复
      try {
        const payload = btoa(unescape(encodeURIComponent(JSON.stringify(mockUser))))
        const isSecure = location.protocol === 'https:'
        const parts = ['path=/', 'max-age=604800', 'SameSite=Lax']
        if (isSecure) parts.push('Secure')
        parts.push('domain=.aizhs.top')
        document.cookie = `mock_user_info=${payload}; ${parts.join('; ')}`
      } catch {
        /* base64 失败不影响主流程,主域 bootstrap 会回退到未登录态 */
      }
      setStatus('success')
      // 复用现有的分域 SSO 跳转逻辑
      if (isAuthSubdomainHost()) {
        setTimeout(() => {
          window.location.href = buildMainDomainUrl('/')
        }, 800)
      } else {
        setTimeout(() => router.push('/'), 800)
      }
      return
    }

    let cancelled = false
    const body = JSON.stringify({ code, state })

    fetchApi<{ token: string; refreshToken?: string; user: unknown }>(apiPath, {
      method: 'POST',
      body,
    })
      .then((res) => {
        if (cancelled) return
        if (!res.success) {
          setStatus('error')
          setErrorMsg(res.error || t('error.loginFailed'))
          return
        }
        if (!res.data) {
          setStatus('error')
          setErrorMsg(t('error.emptyData'))
          return
        }
        setToken(res.data.token, res.data.refreshToken)
        setUser(res.data.user as never)
        setStatus('success')
        // 分域 SSO (2026-07-21):当前在认证子域,Cookie 已写在 .aizhs.top,
        // 跨域生效后跳回主域根路径,主域 useAuthBootstrap 自动读 Cookie 恢复登录态
        if (isAuthSubdomainHost()) {
          setTimeout(() => {
            window.location.href = buildMainDomainUrl('/')
          }, 800)
        } else {
          setTimeout(() => router.push('/'), 800)
        }
      })
      .catch((e: Error) => {
        if (cancelled) return
        setStatus('error')
        setErrorMsg(e.message || t('error.network'))
      })

    return () => {
      cancelled = true
    }
  }, [params, provider, router, setToken, setUser, t])

  if (status === 'loading') {
    return (
      <div className="space-y-4 p-6 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('loading', { provider: providerLabel(provider, t) })}</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="space-y-4 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="text-sm font-medium">{t('success')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6 text-center">
      <XCircle className="mx-auto h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('failedTitle')}</p>
        <p className="text-xs text-muted-foreground">{errorMsg}</p>
      </div>
      <Link
        href="/sso/login"
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {t('backToLogin')}
      </Link>
    </div>
  )
}

/**
 * Suspense 包裹的 OAuth 回调处理器(2026-07-24 A 套壳适配)
 * output:'export' 模式要求 useSearchParams() 被 <Suspense> 边界包裹
 */
export function OAuthCallbackHandler({ provider }: OAuthCallbackHandlerProps) {
  return (
    <React.Suspense fallback={null}>
      <OAuthCallbackHandlerInner provider={provider} />
    </React.Suspense>
  )
}

function providerLabel(
  provider: OAuthCallbackHandlerProps['provider'],
  t: ReturnType<typeof useTranslations>,
): string {
  if (provider === 'google') return t('provider.google')
  if (provider === 'apple') return t('provider.apple')
  return t('provider.thirdParty')
}
