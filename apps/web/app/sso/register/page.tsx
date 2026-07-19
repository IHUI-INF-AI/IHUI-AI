'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Button, Input, Label } from '@ihui/ui'
import { Loader2, ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { AuthShell, AuthShellPage } from '@/components/auth/AuthShell'
import { AgreementCheckbox } from '@/components/auth/AgreementCheckbox'

/**
 * SSO 统一注册页(2026-07-20 重做:整页弹窗化,与主站 LoginDialog 视觉统一)
 *
 * 设计:
 * - 路由保留(/sso/register),外部子项目跳转链接无需改
 * - 视觉改为"全屏遮罩 + 居中弹窗卡片"(AuthShellPage + AuthShell)
 * - 与主站 LoginDialog 共用 AuthShell 外壳,视觉完全统一
 * - 注册流程不变:填表 → 注册成功自动登录 → 调 /api/auth/sso/code → 跳回 redirect?sso_code=xxx
 *
 * 关闭策略:右上 X 按钮 → 跳转 redirect 或首页(让子项目处理"用户取消"逻辑)
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
  const [showAgreeErr, setShowAgreeErr] = React.useState(false)

  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleClose = React.useCallback(() => {
    router.push(redirectUrl)
  }, [router, redirectUrl])

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
      setShowAgreeErr(true)
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

  // 已登录分支:授权跳转卡片
  if (token && user) {
    return (
      <AuthShellPage>
        <AuthShell
          title={registerSuccess ? t('registerSuccess') : t('alreadyLoggedIn')}
          subtitle={t('authorizing', { clientId })}
          onClose={handleClose}
        >
          <Button
            className="h-10 w-full"
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
        </AuthShell>
      </AuthShellPage>
    )
  }

  return (
    <AuthShellPage>
      <AuthShell
        title={t('registerTitle')}
        subtitle={t('subtitle', { clientId })}
        onClose={handleClose}
        footer={t('footerHint')}
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('phone')}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
              autoComplete="tel"
              className="h-10"
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
                className="h-10 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSendCode}
                disabled={sendingCode || countdown > 0 || phone.length !== 11}
                className="h-10 shrink-0"
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
              className="h-10"
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
              className="h-10"
            />
          </div>
          <AgreementCheckbox
            checked={agreed}
            onChange={(v) => {
              setAgreed(v)
              if (v) setShowAgreeErr(false)
            }}
            error={showAgreeErr && !agreed}
          />
          {showAgreeErr && !agreed && (
            <p className="text-xs text-destructive">{t('mustAgree')}</p>
          )}
          <Button type="submit" className="h-10 w-full" disabled={loading || exchanging}>
            {loading || exchanging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {t('registerBtn')}
          </Button>
        </form>
      </AuthShell>
    </AuthShellPage>
  )
}
