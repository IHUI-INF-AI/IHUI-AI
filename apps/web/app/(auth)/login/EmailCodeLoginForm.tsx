'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { Alert } from '@/components/feedback'
import { emailSchema, type TokenResult } from './types'

interface EmailCodeLoginFormProps {
  active: boolean
}

export function EmailCodeLoginForm({ active }: EmailCodeLoginFormProps) {
  const t = useTranslations('auth')
  const router = useRouter()
  const setToken = useAuthStore((s) => s.setToken)

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
      setToken(json.data.accessToken)
      router.push('/')
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
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-code">{t('code')}</Label>
        <div className="flex gap-2">
          <Input
            id="email-code"
            placeholder={t('codePlaceholder')}
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value)}
          />
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
      <Button type="submit" className="w-full" disabled={emailSubmitting}>
        {emailSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}
