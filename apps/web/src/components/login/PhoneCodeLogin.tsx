'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useCountdown } from '@/hooks/use-countdown'

const phoneRegex = /^1[3-9]\d{9}$/

type TokenResult = { userId: string; accessToken: string; refreshToken: string; tokenType: string }

/**
 * 手机验证码登录：发送短信验证码 → 输入验证码 → 登录。
 */
export function PhoneCodeLogin() {
  const t = useTranslations('auth')
  const router = useRouter()
  const setToken = useAuthStore((s) => s.setToken)

  const [phone, setPhone] = React.useState('')
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { count: countdown, start: startCountdown, reset: resetCountdown } = useCountdown(0)
  const [sending, setSending] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const handleSendCode = async () => {
    setError(null)
    if (!phoneRegex.test(phone)) {
      setError(t('invalidPhone'))
      return
    }
    setSending(true)
    try {
      const res = await fetchApi('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone, scene: 'login' }),
      })
      if (!res.success) {
        setError(res.error || t('loginFailed'))
        return
      }
      resetCountdown(60)
      startCountdown()
    } catch {
      setError(t('loginFailed'))
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!phoneRegex.test(phone)) {
      setError(t('invalidPhone'))
      return
    }
    if (!code.trim()) {
      setError(t('enterCode'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetchApi<TokenResult>('/api/auth/login/phone-code', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      })
      if (!res.success) {
        setError(res.error || t('loginFailed'))
        return
      }
      if (!res.data?.accessToken) {
        setError(t('loginFailed'))
        return
      }
      setToken(res.data.accessToken, res.data.refreshToken)
      router.push('/')
    } catch {
      setError(t('loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="phone-code-phone">{t('phone')}</Label>
        <Input
          id="phone-code-phone"
          type="tel"
          autoComplete="tel"
          placeholder={t('phonePlaceholder')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone-code-code">{t('code')}</Label>
        <div className="flex gap-2">
          <Input
            id="phone-code-code"
            inputMode="numeric"
            placeholder={t('codePlaceholder')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
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
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}
