'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Alert } from '@/components/feedback'
import { emailSchema, type TokenResult } from './login-schemas'

interface EmailCodeLoginFormProps {
  active: boolean
  onSuccess?: () => void
  agreed?: boolean
  onRequireAgree?: () => void
  showAgreeErr?: boolean
}

export function EmailCodeLoginForm({
  active,
  onSuccess,
  agreed = true,
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
    if (!emailCode.trim()) {
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
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <div className="input-gradient-wrap rounded-md">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            className="h-9 rounded-[7px] border border-input bg-background"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-code">{t('code')}</Label>
        <div className="flex gap-2">
          <div className="input-gradient-wrap flex-1 rounded-md">
            <Input
              id="email-code"
              placeholder={t('codePlaceholder')}
              className="h-9 rounded-[7px] border border-input bg-background"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={sendingEmail || emailCountdown > 0}
            onClick={onSendEmailCode}
          >
            {emailCountdown > 0 ? t('resendCode', { seconds: emailCountdown }) : t('sendEmailCode')}
          </Button>
        </div>
      </div>
      {showAgreeErr && !agreed && <p className="text-xs text-destructive">{t('agreeRequired')}</p>}
      <Button type="submit" className="w-full" disabled={emailSubmitting || !agreed}>
        {emailSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}
