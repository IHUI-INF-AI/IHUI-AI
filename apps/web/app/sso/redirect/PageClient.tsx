'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { decodeUserFromToken, isAuthenticated } from '@/lib/auth-utils'

/**
 * A 套壳:output:export 不支持 cookies() + await fetch() + redirect() + searchParams: Promise SSR
 * 改为客户端实现:读 document.cookie → 调 API → router.replace
 *
 * 安全说明:URL 白名单校验在客户端执行(output:export 限制),
 * 真正的安全边界由 SSO code 生成 API(apps/api)服务端保证。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''

function detectApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) {
      return 'http://127.0.0.1:8802'
    }
  }
  return API_BASE
}

function isAllowedRedirect(url: string): boolean {
  if (!url) return false
  if (url.startsWith('/') && !url.startsWith('//')) return true
  try {
    const parsed = new URL(url)
    const allowed = process.env.NEXT_PUBLIC_SSO_ALLOWED_ORIGINS
    if (allowed) {
      const origins = allowed.split(',').map((s) => s.trim())
      if (origins.includes(parsed.origin)) return true
    }
    return false
  } catch {
    return false
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match && match[1] ? decodeURIComponent(match[1]) : null
}

export default function SsoRedirectPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('sso.redirect')
  const [error, setError] = useState<string | null>(null)

  const targetUrl = searchParams.get('redirect') || '/'
  const clientId = searchParams.get('client_id') || 'web'

  useEffect(() => {
    if (!isAllowedRedirect(targetUrl)) {
      setError('notAllowed')
      return
    }

    const token = getCookie('auth_token') ?? getCookie('token')

    if (!isAuthenticated(token)) {
      const loginRedirect = encodeURIComponent(
        `/sso/redirect?redirect=${encodeURIComponent(targetUrl)}&client_id=${clientId}`,
      )
      router.replace(`/sso/login?redirect=${loginRedirect}`)
      return
    }

    const user = decodeUserFromToken(token!)
    if (!user) {
      router.replace('/sso/login')
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const base = detectApiBaseUrl()
        const resp = await fetch(`${base}/api/auth/sso/code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ clientId, redirectUri: targetUrl }),
        })

        if (!resp.ok) {
          throw new Error(`SSO code generation failed: ${resp.status}`)
        }

        const data = await resp.json()
        if (data.code !== 200 || !data.data?.code) {
          throw new Error(data.message || 'SSO code generation failed')
        }

        if (cancelled) return
        const ssoCode = data.data.code as string
        const separator = targetUrl.includes('?') ? '&' : '?'
        router.replace(`${targetUrl}${separator}sso_code=${ssoCode}`)
      } catch {
        if (cancelled) return
        const nextPath = `/sso/redirect?redirect=${encodeURIComponent(targetUrl)}&client_id=${clientId}`
        router.replace(`/?reauth=1&next=${encodeURIComponent(nextPath)}`)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, targetUrl, clientId])

  if (error === 'notAllowed') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">{t('notAllowed')}</h1>
          <p className="text-muted-foreground text-sm">{t('notAllowedDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
      <div className="text-center space-y-2">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        <p className="text-muted-foreground text-sm">正在跳转...</p>
      </div>
    </div>
  )
}
