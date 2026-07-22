'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Alert } from '@/components/feedback'
import { AgreementCheckbox } from '@/components/auth/AgreementCheckbox'
import { phoneSchema, type TokenResult } from './login-schemas'
import { OtpInput } from './OtpInput'

interface PhoneCodeLoginFormProps {
  active: boolean
  onSuccess?: () => void
  agreed?: boolean
  onAgreedChange?: (v: boolean) => void
  onRequireAgree?: () => void
  showAgreeErr?: boolean
}

export function PhoneCodeLoginForm({
  active,
  onSuccess,
  agreed = true,
  onAgreedChange,
  onRequireAgree,
  showAgreeErr,
}: PhoneCodeLoginFormProps) {
  const t = useTranslations('auth')
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)

  const [phone, setPhone] = React.useState('')
  const [code, setCode] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)
  const [countdown, setCountdown] = React.useState(0)
  const [sending, setSending] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!active) setErr(null)
  }, [active])

  const startCountdown = () => {
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const onSendCode = async () => {
    setErr(null)
    const parsed = phoneSchema.safeParse(phone)
    if (!parsed.success) {
      setErr(t('invalidPhone'))
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/auth/sms/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const json = (await res.json()) as { code: number; message: string }
      if (!res.ok || json.code !== 0) {
        setErr(json.message || t('loginFailed'))
        return
      }
      startCountdown()
    } catch {
      setErr(t('loginFailed'))
    } finally {
      setSending(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!agreed) {
      onRequireAgree?.()
      return
    }
    const pp = phoneSchema.safeParse(phone)
    if (!pp.success) {
      setErr(t('invalidPhone'))
      return
    }
    if (code.length !== 6) {
      setErr(t('enterCode'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login/phone-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const json = (await res.json()) as { code: number; message: string; data?: TokenResult }
      if (!res.ok || json.code !== 0 || !json.data?.accessToken) {
        setErr(json.message || t('loginFailed'))
        return
      }
      setToken(json.data.accessToken, json.data.refreshToken)
      if (json.data.userId) {
        setUser({ id: json.data.userId, nickname: '' })
        void fetchApi<{ user: AuthUser }>('/api/auth/me').then((r) => {
          if (r.success) setUser(r.data.user)
        })
      }
      onSuccess?.()
    } catch {
      setErr(t('loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      {err && <Alert variant="danger" description={err} />}
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder={t('phonePlaceholder')}
          className="h-10"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('code')}</Label>
        <div className="flex items-center gap-2">
          <OtpInput
            value={code}
            onChange={setCode}
            disabled={submitting}
            aria-label={t('code')}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 px-3 text-sm"
            disabled={sending || countdown > 0}
            onClick={onSendCode}
          >
            {countdown > 0 ? t('resendCode', { seconds: countdown }) : t('getVerificationCode')}
          </Button>
        </div>
      </div>
      <AgreementCheckbox
        checked={agreed}
        onChange={(v) => onAgreedChange?.(v)}
        error={showAgreeErr && !agreed}
      />
      {showAgreeErr && !agreed && <p className="text-xs text-destructive">{t('agreeRequired')}</p>}
      <Button type="submit" className="h-10 w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}
