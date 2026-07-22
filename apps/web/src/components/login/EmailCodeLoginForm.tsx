'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Check } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Alert } from '@/components/feedback'
import { AgreementCheckbox } from '@/components/auth/AgreementCheckbox'
import { emailSchema, type TokenResult } from './login-schemas'
import { OtpInput } from './OtpInput'
import { loadLocalLoginPrefs, saveLocalLoginPrefs } from '@/lib/login-preferences'

interface EmailCodeLoginFormProps {
  active: boolean
  onSuccess?: () => void
  agreed?: boolean
  onAgreedChange?: (v: boolean) => void
  onRequireAgree?: () => void
  showAgreeErr?: boolean
}

export function EmailCodeLoginForm({
  active,
  onSuccess,
  agreed = true,
  onAgreedChange,
  onRequireAgree,
  showAgreeErr,
}: EmailCodeLoginFormProps) {
  const t = useTranslations('auth')
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)

  const [email, setEmail] = React.useState('')
  const [emailCode, setEmailCode] = React.useState('')
  const [emailErr, setEmailErr] = React.useState<string | null>(null)
  const [emailCountdown, setEmailCountdown] = React.useState(0)
  const [sendingEmail, setSendingEmail] = React.useState(false)
  const [emailSubmitting, setEmailSubmitting] = React.useState(false)
  const [autoLogin, setAutoLogin] = React.useState(loadLocalLoginPrefs().autoLogin)

  React.useEffect(() => {
    if (!active) setEmailErr(null)
  }, [active])

  const startCountdown = (setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter(60)
    const timer = setInterval(() => {
      setter((c) => {
        if (c <= 1) {
          clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const onSendEmailCode = async () => {
    setEmailErr(null)
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setEmailErr(t('invalidEmail'))
      return
    }
    setSendingEmail(true)
    try {
      const res = await fetch('/api/auth/email/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = (await res.json()) as { code: number; message: string }
      if (!res.ok || json.code !== 0) {
        setEmailErr(json.message || t('loginFailed'))
        return
      }
      startCountdown(setEmailCountdown)
    } catch {
      setEmailErr(t('loginFailed'))
    } finally {
      setSendingEmail(false)
    }
  }

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailErr(null)
    if (!agreed) {
      onRequireAgree?.()
      return
    }
    const ep = emailSchema.safeParse(email)
    if (!ep.success) {
      setEmailErr(t('invalidEmail'))
      return
    }
    if (emailCode.length !== 6) {
      setEmailErr(t('enterCode'))
      return
    }
    setEmailSubmitting(true)
    try {
      const res = await fetch('/api/auth/login/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: emailCode }),
      })
      const json = (await res.json()) as { code: number; message: string; data?: TokenResult }
      if (!res.ok || json.code !== 0 || !json.data?.accessToken) {
        setEmailErr(json.message || t('loginFailed'))
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
      setEmailErr(t('loginFailed'))
    } finally {
      setEmailSubmitting(false)
    }
  }

  return (
    <form onSubmit={onEmailSubmit} className="space-y-4 pt-2">
      {emailErr && <Alert variant="danger" description={emailErr} />}
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          className="h-10"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('code')}</Label>
        <div className="flex items-center gap-2">
          <OtpInput
            value={emailCode}
            onChange={setEmailCode}
            disabled={emailSubmitting}
            aria-label={t('code')}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 px-3 text-sm"
            disabled={sendingEmail || emailCountdown > 0}
            onClick={onSendEmailCode}
          >
            {emailCountdown > 0
              ? t('resendCode', { seconds: emailCountdown })
              : t('getVerificationCode')}
          </Button>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3">
        <MiniCheckbox
          checked={autoLogin}
          onChange={(v) => {
            setAutoLogin(v)
            saveLocalLoginPrefs({ autoLogin: v })
          }}
          label={t('autoLogin')}
        />
        <div className="flex-1">
          <AgreementCheckbox
            checked={agreed}
            onChange={(v) => onAgreedChange?.(v)}
            error={showAgreeErr && !agreed}
          />
          {showAgreeErr && !agreed && <p className="text-xs text-destructive">{t('agreeRequired')}</p>}
        </div>
      </div>
      <Button type="submit" className="h-10 w-full" disabled={emailSubmitting}>
        {emailSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}

function MiniCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="group flex cursor-pointer items-center gap-2 select-none">
      <span
        onClick={(e) => { e.preventDefault(); onChange(!checked) }}
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-200',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background group-hover:border-foreground/60',
        ].join(' ')}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!checked) } }}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input type="checkbox" className="sr-only" tabIndex={-1} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-xs leading-5 text-muted-foreground">{label}</span>
    </label>
  )
}
