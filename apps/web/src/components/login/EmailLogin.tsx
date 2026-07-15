'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'

import { Button, Input, Label } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { CaptchaCanvas } from './CaptchaCanvas'

const emailSchema = z.string().email()

type TokenResult = { userId: string; accessToken: string; refreshToken: string; tokenType: string }

/**
 * 邮箱登录：邮箱 + 密码 + 图形验证码。
 */
export function EmailLogin() {
  const t = useTranslations('auth')
  const router = useRouter()
  const setToken = useAuthStore((s) => s.setToken)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [captcha, setCaptcha] = React.useState('')
  const [captchaOk, setCaptchaOk] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setError(t('invalidEmail'))
      return
    }
    if (password.length < 6) {
      setError(t('invalidPassword'))
      return
    }
    if (!captchaOk) {
      setError(t('captchaPlaceholder'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = (await res.json()) as { code: number; message: string; data?: TokenResult }
      if (!res.ok || json.code !== 0 || !json.data?.accessToken) {
        setError(json.message || t('loginFailed'))
        return
      }
      setToken(json.data.accessToken, json.data.refreshToken)
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
        <Label htmlFor="email-login-email">{t('email')}</Label>
        <Input
          id="email-login-email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-login-pwd">{t('password')}</Label>
        <Input
          id="email-login-pwd"
          type="password"
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-login-captcha">{t('captcha')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="email-login-captcha"
            placeholder={t('captchaPlaceholder')}
            value={captcha}
            onChange={(e) => setCaptcha(e.target.value)}
          />
          <CaptchaCanvas value={captcha} onVerify={setCaptchaOk} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}
