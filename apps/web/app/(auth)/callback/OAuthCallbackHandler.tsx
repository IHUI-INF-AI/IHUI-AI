'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

type Status = 'loading' | 'success' | 'error'

interface OAuthCallbackHandlerProps {
  provider: 'generic' | 'google' | 'apple'
}

const PROVIDER_API: Record<OAuthCallbackHandlerProps['provider'], string> = {
  generic: '/api/auth/callback',
  google: '/api/auth/google/callback',
  apple: '/api/auth/apple/callback',
}

export function OAuthCallbackHandler({ provider }: OAuthCallbackHandlerProps) {
  const router = useRouter()
  const params = useSearchParams()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const [status, setStatus] = React.useState<Status>('loading')
  const [errorMsg, setErrorMsg] = React.useState<string>('')

  React.useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')

    if (!code) {
      setStatus('error')
      setErrorMsg('缺少授权码参数,请重新发起登录')
      return
    }

    let cancelled = false
    const apiPath = PROVIDER_API[provider]
    const body = JSON.stringify({ code, state })

    fetchApi<{ token: string; user: unknown }>(apiPath, { method: 'POST', body })
      .then((res) => {
        if (cancelled) return
        if (!res.success) {
          setStatus('error')
          setErrorMsg(res.error || '登录失败,请稍后重试')
          return
        }
        if (!res.data) {
          setStatus('error')
          setErrorMsg('登录返回数据为空')
          return
        }
        setToken(res.data.token)
        setUser(res.data.user as never)
        setStatus('success')
        setTimeout(() => router.push('/'), 800)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setStatus('error')
        setErrorMsg(e.message || '网络错误,请检查连接')
      })

    return () => {
      cancelled = true
    }
  }, [params, provider, router, setToken, setUser])

  if (status === 'loading') {
    return (
      <div className="space-y-4 p-6 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在处理{providerLabel(provider)}登录...</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="space-y-4 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="text-sm font-medium">登录成功,即将跳转...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6 text-center">
      <XCircle className="mx-auto h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm font-medium">登录失败</p>
        <p className="text-xs text-muted-foreground">{errorMsg}</p>
      </div>
      <Link
        href="/sso/login"
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        返回登录
      </Link>
    </div>
  )
}

function providerLabel(provider: OAuthCallbackHandlerProps['provider']): string {
  if (provider === 'google') return 'Google'
  if (provider === 'apple') return 'Apple'
  return '第三方'
}
