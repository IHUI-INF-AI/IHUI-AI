'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

/**
 * A 套壳:output:export 不支持 cookies() + await fetch() + redirect() + searchParams: Promise SSR
 * 改为客户端实现:调 API(靠 httpOnly cookie 自动附带)→ router.replace
 *
 * P2-18 修复(2026-08-06):auth_token/refresh_token 已改由后端 httpOnly Set-Cookie 管理,
 * 前端 JS 读不到 cookie,不再读 document.cookie。流程改为:
 *  1. GET /api/auth/me(cookie 自动附带)确认登录态;
 *  2. 已登录 → POST /api/auth/sso/code 换一次性 code;
 *  3. 未登录 → 跳 /sso/login。
 *
 * 安全说明:URL 白名单校验在客户端执行(output:export 限制),
 * 真正的安全边界由 SSO code 生成 API(apps/api)服务端保证。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''

function detectApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if ('__TAURI_INTERNALS__' in window) {
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

    let cancelled = false
    void (async () => {
      try {
        const base = detectApiBaseUrl()

        // P2-18:登录态校验改走 /auth/me(httpOnly cookie 自动附带),不再读 document.cookie
        const meRes = await fetch(`${base}/api/auth/me`, {
          method: 'GET',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'include',
        })

        if (!meRes.ok) {
          // 未登录:跳登录页,登录成功后带回 redirect 继续 SSO 流程
          const loginRedirect = encodeURIComponent(
            `/sso/redirect?redirect=${encodeURIComponent(targetUrl)}&client_id=${clientId}`,
          )
          router.replace(`/sso/login?redirect=${loginRedirect}`)
          return
        }

        // P2-18:不拼 Bearer header,靠 httpOnly cookie 认证;
        // 状态变更方法走 cookie 认证需 X-Requested-With 满足后端 CSRF 校验
        const resp = await fetch(`${base}/api/auth/sso/code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({ clientId, redirectUri: targetUrl }),
        })

        if (!resp.ok) {
          throw new Error(`SSO code generation failed: ${resp.status}`)
        }

        const data = await resp.json()
        // API 统一响应 success() = { code: 0, message, data }
        // 2026-08-01 修复:原 code !== 200 永远抛错,导致 SSO redirect 流程误判失败
        if (data.code !== 0 || !data.data?.code) {
          throw new Error(data.message || 'SSO code generation failed')
        }

        if (cancelled) return
        const ssoCode = data.data.code as string
        const separator = targetUrl.includes('?') ? '&' : '?'
        const finalUrl = `${targetUrl}${separator}sso_code=${ssoCode}`
        // Custom scheme(如 ihui://)需用 window.location.href 触发 OS deep-link handler,
        // router.replace 无法处理非 http/https 协议(2026-08-01 desktop SSO 闭环修复)
        const isCustomScheme =
          !targetUrl.startsWith('http://') &&
          !targetUrl.startsWith('https://') &&
          !targetUrl.startsWith('/')
        if (isCustomScheme) {
          window.location.href = finalUrl
        } else {
          router.replace(finalUrl)
        }
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
        <Loader2 className="inline-block h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">正在跳转...</p>
      </div>
    </div>
  )
}
