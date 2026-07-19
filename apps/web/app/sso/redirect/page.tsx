import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { decodeUserFromToken, isAuthenticated } from '@/lib/auth-utils'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('sso.redirect')
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

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

export default async function SsoRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; client_id?: string }>
}) {
  const params = await searchParams
  const targetUrl = params.redirect || '/'
  const clientId = params.client_id || 'web'

  if (!isAllowedRedirect(targetUrl)) {
    const t = await getTranslations('sso.redirect')
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">{t('notAllowed')}</h1>
          <p className="text-muted-foreground text-sm">{t('notAllowedDesc')}</p>
        </div>
      </div>
    )
  }

  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value ?? cookieStore.get('token')?.value ?? null

  if (!isAuthenticated(token)) {
    const loginRedirect = encodeURIComponent(
      `/sso/redirect?redirect=${encodeURIComponent(targetUrl)}&client_id=${clientId}`,
    )
    redirect(`/sso/login?redirect=${loginRedirect}`)
  }

  const user = decodeUserFromToken(token!)
  if (!user) {
    redirect('/sso/login')
  }

  let ssoCode: string | null = null
  try {
    const resp = await fetch(`${API_BASE}/api/auth/sso/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ clientId, redirectUri: targetUrl }),
      cache: 'no-store',
    })

    if (!resp.ok) {
      throw new Error(`SSO code generation failed: ${resp.status}`)
    }

    const data = await resp.json()
    if (data.code !== 200 || !data.data?.code) {
      throw new Error(data.message || 'SSO code generation failed')
    }
    ssoCode = data.data.code
  } catch {
    // SSO code generation failed — redirect to home with reauth query params
    // so the frontend LoginRedirectListener opens the login dialog and re-triggers
    // the SSO flow after successful authentication.
    const nextPath = `/sso/redirect?redirect=${encodeURIComponent(targetUrl)}&client_id=${clientId}`
    redirect(`/?reauth=1&next=${encodeURIComponent(nextPath)}`)
  }

  if (ssoCode) {
    const separator = targetUrl.includes('?') ? '&' : '?'
    redirect(`${targetUrl}${separator}sso_code=${ssoCode}`)
  }
}
