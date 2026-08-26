'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, ShieldAlert } from 'lucide-react'

/**
 * SSO 移动端授权消费页(2026-08-27 立,App→Web 会话打通)
 *
 * 链路:移动端 App 已登录 → 调 /api/auth/sso/code 生成一次性 sso_code(30s)
 *      → WebView 打开 /sso/mobile-auth?sso_code=xxx&redirect=<目标URL>
 *      → 本页调 /api/auth/sso/exchange 消费 code → 响应自动 Set-Cookie auth_token
 *      → 跳转 redirect 目标页(免登录)
 *
 * 失败兜底:显示错误 + 返回登录页链接(code 过期/已消费/网络异常均不影响主站)
 */
export default function SsoMobileAuthPage() {
  const t = useTranslations('sso.mobileAuth')
  const searchParams = useSearchParams()
  const code = searchParams.get('sso_code') || searchParams.get('code') || ''
  const redirectUrl = searchParams.get('redirect') || '/'

  const [state, setState] = React.useState<'processing' | 'failed'>('processing')
  const [errorMsg, setErrorMsg] = React.useState('')

  React.useEffect(() => {
    if (!code) {
      setState('failed')
      setErrorMsg(t('missingCode'))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/auth/sso/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ code, clientId: 'web' }),
          credentials: 'include',
        })
        const json = (await res.json()) as { code?: number; message?: string }
        if (cancelled) return
        if (res.ok && json.code === 0) {
          // exchange 响应已由后端 Set-Cookie(auth_token/refresh_token httpOnly),直接跳转
          window.location.replace(redirectUrl)
          return
        }
        setState('failed')
        setErrorMsg(json.message || t('exchangeFailed'))
      } catch {
        if (!cancelled) {
          setState('failed')
          setErrorMsg(t('networkError'))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, redirectUrl, t])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
      {state === 'processing' ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('processing')}</p>
        </>
      ) : (
        <>
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <p className="max-w-md text-center text-sm text-muted-foreground">{errorMsg}</p>
          <Link
            href="/login"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            {t('backToLogin')}
          </Link>
        </>
      )}
    </div>
  )
}
