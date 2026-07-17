'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Button, Input, Label } from '@ihui/ui'
import { Loader2, ShieldCheck, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function SsoLoginPage() {
  const t = useTranslations('sso')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'
  const clientId = searchParams.get('client_id') || 'web'

  const { token, user } = useAuthStore()
  const [account, setAccount] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [exchanging, setExchanging] = React.useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!account.trim() || !password) {
      toast.error(t('enterAccountAndPassword'))
      return
    }
    setLoading(true)
    try {
      const r = await fetchApi<{
        accessToken: string
        refreshToken?: string
        user: {
          id: string
          nickname: string
          avatar?: string
          roleId?: number
          permissions?: string[]
        }
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account, password }),
      })
      if (r.success && r.data) {
        useAuthStore.getState().setToken(r.data.accessToken, r.data.refreshToken ?? null)
        useAuthStore.getState().setUser({
          ...r.data.user,
          permissions: r.data.user.permissions ?? [],
        })
        toast.success(t('loginSuccess'))
        await generateCodeAndRedirect()
      } else {
        toast.error(!r.success ? r.error : t('loginFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function generateCodeAndRedirect() {
    const currentToken = useAuthStore.getState().token
    if (!currentToken) return
    setExchanging(true)
    try {
      const r = await fetchApi<{ code: string; redirectUri: string }>('/api/auth/sso/code', {
        method: 'POST',
        body: JSON.stringify({ clientId, redirectUri: redirectUrl }),
      })
      if (r.success && r.data?.code) {
        const separator = redirectUrl.includes('?') ? '&' : '?'
        router.push(`${redirectUrl}${separator}sso_code=${r.data.code}`)
      } else {
        toast.error(!r.success ? r.error : t('generateCodeFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('generateCodeFailed'))
    } finally {
      setExchanging(false)
    }
  }

  if (token && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">{t('alreadyLoggedIn')}</h1>
            <p className="text-sm text-muted-foreground">{t('authorizing', { clientId })}</p>
          </div>
          <Button
            className="w-full"
            onClick={() => generateCodeAndRedirect()}
            disabled={exchanging}
          >
            {exchanging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {t('authorizeAndRedirect')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle', { clientId })}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('account')}</Label>
            <Input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={t('accountPlaceholder')}
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('password')}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || exchanging}>
            {loading || exchanging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('loginBtn')}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">{t('footerHint')}</p>
      </div>
    </div>
  )
}
