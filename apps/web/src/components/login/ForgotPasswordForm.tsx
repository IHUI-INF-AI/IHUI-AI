'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button, Input, Label, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator'
import { useLoginDialogStore } from '@/stores/login-dialog'

const phoneRegex = /^1[3-9]\d{9}$/
const emailSchema = z.string().email()

/**
 * 找回密码：支持「手机验证码」与「邮箱验证码」两种重置方式。
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth')
  const [method, setMethod] = React.useState<'phone' | 'email'>('phone')

  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')

  const [submitting, setSubmitting] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const target = method === 'phone' ? phone : email

  const handleSendCode = async () => {
    setError(null)
    if (method === 'phone' && !phoneRegex.test(phone)) {
      setError(t('invalidPhone'))
      return
    }
    if (method === 'email' && !emailSchema.safeParse(email).success) {
      setError(t('invalidEmail'))
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [method]: target, scene: 'reset' }),
      })
      const json = (await res.json()) as { code: number; message: string }
      if (!res.ok || json.code !== 0) {
        setError(json.message || t('registerFailed'))
        return
      }
      toast.success(t('codeSent'))
      setCountdown(60)
    } catch {
      setError(t('registerFailed'))
    } finally {
      setSending(false)
    }
  }

  const handleReset = async () => {
    setError(null)
    if (!code) return setError(t('enterCode'))
    if (newPassword.length < 6) return setError(t('invalidPassword'))
    if (newPassword !== confirmPassword) return setError(t('passwordMismatch'))
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, target, code, newPassword }),
      })
      const json = (await res.json()) as { code: number; message: string }
      if (!res.ok || json.code !== 0) {
        setError(json.message || t('registerFailed'))
        return
      }
      toast.success(t('resetSuccess'))
      useLoginDialogStore.getState().open('login')
    } catch {
      setError(t('registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={method}
        onValueChange={(v) => {
          setMethod(v as typeof method)
          setError(null)
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="phone">{t('phone')}</TabsTrigger>
          <TabsTrigger value="email">{t('email')}</TabsTrigger>
        </TabsList>

        <TabsContent value="phone" className="pt-4">
          <div className="input-gradient-wrap rounded-md">
            <Input
              type="tel"
              autoComplete="tel"
              placeholder={t('enterPhone')}
              className="h-9 rounded-[7px] border border-input bg-background"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </TabsContent>
        <TabsContent value="email" className="pt-4">
          <div className="input-gradient-wrap rounded-md">
            <Input
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              className="h-9 rounded-[7px] border border-input bg-background"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fp-code">{t('code')}</Label>
        <div className="flex gap-2">
          <div className="input-gradient-wrap flex-1 rounded-md">
            <Input
              id="fp-code"
              inputMode="numeric"
              placeholder={t('enterCode')}
              className="h-9 rounded-[7px] border border-input bg-background"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={sending || countdown > 0}
            onClick={handleSendCode}
          >
            {countdown > 0 ? t('resendCode', { seconds: countdown }) : t('sendCode')}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fp-new">{t('newPassword')}</Label>
        <div className="input-gradient-wrap rounded-md">
          <Input
            id="fp-new"
            type="password"
            autoComplete="new-password"
            placeholder={t('enterNewPassword')}
            className="h-9 rounded-[7px] border border-input bg-background"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <PasswordStrengthIndicator password={newPassword} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fp-confirm">{t('confirmPassword')}</Label>
        <div className="input-gradient-wrap rounded-md">
          <Input
            id="fp-confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t('enterNewPassword')}
            className="h-9 rounded-[7px] border border-input bg-background"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </div>

      <Button type="button" className="w-full" disabled={submitting} onClick={handleReset}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('resetPassword')}
      </Button>
    </div>
  )
}
