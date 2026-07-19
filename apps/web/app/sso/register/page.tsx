'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Button, Input, Label } from '@ihui/ui'
import { Loader2, ShieldCheck, ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'

/**
 * SSO 统一注册页(整页,与 /sso/login 对称)
 *
 * 设计:外部子项目(client_id)引导用户来此注册 → 注册成功自动登录 →
 * 调 /api/auth/sso/code 生成 30s 一次性 code → 跳回 redirect?sso_code=xxx
 *
 * 不再走主站 LoginDialog 弹窗(弹窗依赖主站 layout/JS bundle,
 * 违背"轻量 SSO 中心"原则;且与 /sso/login 整页体验不对称)。
 */
export default function SsoRegisterPage() {
  const t = useTranslations('sso')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'
  const clientId = searchParams.get('client_id') || 'web'

  const { token, user } = useAuthStore()
  const [phone, setPhone] = React.useState('')
  const [code, setCode] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [agreed, setAgreed] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [exchanging, setExchanging] = React.useState(false)
  const [sendingCode, setSendingCode] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)
  const [registerSuccess, setRegisterSuccess] = React.useState(false)

  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  async function handleSendCode() {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error(t('invalidPhone'))
      return
    }
    setSendingCode(true)
    try {
      const r = await fetchApi<{ sent: boolean }>('/api/auth/sms/send', {
        method: 'POST',
        body: JSON.stringify({ phone, scene: 'register' }),
      })
      if (r.success) {
        toast.success(t('codeSent'))
        setCountdown(60)
      } else {
        toast.error(!r.success ? r.error : t('sendCodeFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('sendCodeFailed'))
    } finally {
      setSendingCode(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error(t('invalidPhone'))
      return
    }
    if (code.length < 4) {
      toast.error(t('codeRequired'))
      return
    }
    if (password.length < 6) {
      toast.error(t('passwordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      toast.error(t('passwordMismatch'))
      return
    }
    if (!agreed) {
      toast.error(t('mustAgree'))
      return
    }
    setLoading(true)
    try {
      const r = await fetchApi<{
        accessToken: string
        refreshToken?: string
        user: { id: string; nickname: string; avatar?: string; roleId?: number }
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ phone, password, code }),
      })
      if (r.success && r.data) {
        useAuthStore.getState().setToken(r.data.accessToken, r.data.refreshToken ?? null)
        useAuthStore.getState().setUser(r.data.user)
        setRegisterSuccess(true)
        toast.success(t('registerSuccess'))
        await generateCodeAndRedirect()
      } else {
        toast.error(!r.success ? r.error : t('registerFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('registerFailed'))
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

  // 已登录分支:直接授权跳转
  if (token && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              {registerSuccess ? (
                <Check className="h-6 w-6 text-primary" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-primary" />
              )}
            </div>
            <h1 className="text-xl font-semibold">
              {registerSuccess ? t('registerSuccess') : t('alreadyLoggedIn')}
            </h1>
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
          <h1 className="text-xl font-semibold">{t('registerTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle', { clientId })}</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('phone')}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('code')}</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('codePlaceholder')}
                maxLength={6}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSendCode}
                disabled={sendingCode || countdown > 0 || phone.length !== 11}
                className="shrink-0"
              >
                {countdown > 0 ? `${countdown}s` : t('getCode')}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('password')}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('confirmPassword')}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPasswordPlaceholder')}
              autoComplete="new-password"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>{t('agreeTerms')}</span>
          </label>
          <Button type="submit" className="w-full" disabled={loading || exchanging}>
            {loading || exchanging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('registerBtn')}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">{t('footerHint')}</p>
      </div>
    </div>
  )
}
