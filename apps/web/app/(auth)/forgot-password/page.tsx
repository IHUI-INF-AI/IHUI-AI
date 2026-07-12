'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Input, Label } from '@ihui/ui'
import { PasswordStrengthIndicator } from '@/components/login'

const phoneRegex = /^1[3-9]\d{9}$/

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const router = useRouter()

  const [step, setStep] = React.useState<1 | 2>(1)
  const [phone, setPhone] = React.useState('')
  const [code, setCode] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')

  const [submitting, setSubmitting] = React.useState(false)
  const [sendingCode, setSendingCode] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSendCode = async () => {
    setError(null)
    if (!phoneRegex.test(phone)) {
      setError(t('invalidPhone'))
      return
    }
    setSendingCode(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, scene: 'reset' }),
      })
      const json = (await res.json()) as { code: number; message: string }
      if (!res.ok || json.code !== 0) {
        setError(json.message || t('registerFailed'))
        return
      }
      toast.success(t('codeSent'))
      setCountdown(60)
      setStep(2)
    } catch {
      setError(t('registerFailed'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleReset = async () => {
    setError(null)
    if (!code) {
      setError(t('enterCode'))
      return
    }
    if (!newPassword) {
      setError(t('enterNewPassword'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, newPassword }),
      })
      const json = (await res.json()) as { code: number; message: string }
      if (!res.ok || json.code !== 0) {
        setError(json.message || t('registerFailed'))
        return
      }
      toast.success(t('resetSuccess'))
      router.push('/login')
    } catch {
      setError(t('registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1.5 text-center">
        <h2 className="text-xl font-semibold tracking-tight">{t('forgotPassword')}</h2>
        <p className="text-sm text-muted-foreground">{t('forgotPasswordDesc')}</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === 1 ? (
        <div className="space-y-2">
          <Label htmlFor="phone">{t('phone')}</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder={t('enterPhone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button
            type="button"
            className="w-full"
            disabled={sendingCode || countdown > 0}
            onClick={handleSendCode}
          >
            {sendingCode && <Loader2 className="h-4 w-4 animate-spin" />}
            {countdown > 0 ? t('resendCode', { seconds: countdown }) : t('sendCode')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">{t('code')}</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              placeholder={t('enterCode')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t('enterNewPassword')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PasswordStrengthIndicator password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t('enterNewPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="button" className="w-full" disabled={submitting} onClick={handleReset}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('resetPassword')}
          </Button>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </div>
  )
}
