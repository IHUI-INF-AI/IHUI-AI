'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

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

export function OAuthCallbackHandler({ provider }: OAuthCallbackHandlerProps) {
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
        setTimeout(() => router.push('/'), 800)
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

function providerLabel(
  provider: OAuthCallbackHandlerProps['provider'],
  t: ReturnType<typeof useTranslations>,
): string {
  if (provider === 'google') return t('provider.google')
  if (provider === 'apple') return t('provider.apple')
  return t('provider.thirdParty')
}
