'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'

const registerSchema = z
  .object({
    phone: z.string().regex(/^1[3-9]\d{9}$/, 'auth.invalidPhone'),
    code: z.string().min(4, 'auth.codePlaceholder'),
    password: z.string().min(6, 'auth.invalidPassword'),
    confirmPassword: z.string().min(6, 'auth.invalidPassword'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  })

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const t = useTranslations('auth')
  const router = useRouter()

  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [serverInfo, setServerInfo] = React.useState<string | null>(null)

  const [countdown, setCountdown] = React.useState(0)
  const [sendingCode, setSendingCode] = React.useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema as never),
    defaultValues: { phone: '', code: '', password: '', confirmPassword: '' },
  })

  const resolveError = (key: string) => {
    const map: Record<string, string> = {
      'auth.invalidPhone': t('invalidPhone'),
      'auth.invalidPassword': t('invalidPassword'),
      'auth.passwordMismatch': t('passwordMismatch'),
      'auth.codePlaceholder': t('codePlaceholder'),
    }
    return map[key] ?? key
  }

  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSendCode = async () => {
    const phone = getValues('phone')
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setServerError(t('invalidPhone'))
      return
    }
    setServerError(null)
    setSendingCode(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      if (res.ok) {
        setServerInfo(t('codeSent'))
        setCountdown(60)
      } else {
        setServerError(t('registerFailed'))
      }
    } catch {
      setServerError(t('registerFailed'))
    } finally {
      setSendingCode(false)
    }
  }

  const onSubmit = async (values: RegisterValues) => {
    setServerError(null)
    setServerInfo(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const json = (await res.json()) as { code: number; message: string }
      if (!res.ok || json.code !== 0) {
        setServerError(json.message || t('registerFailed'))
        return
      }
      setServerInfo(t('registerSuccess'))
      setTimeout(() => router.push('/login'), 800)
    } catch {
      setServerError(t('registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
      <div className="space-y-1.5 text-center">
        <h2 className="text-xl font-semibold tracking-tight">{t('registerTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('registerSubtitle')}</p>
      </div>

      {serverError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}
      {serverInfo && (
        <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{serverInfo}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder={t('phonePlaceholder')}
          {...register('phone')}
        />
        {errors.phone && (
          <p className="text-xs text-destructive">{resolveError(errors.phone.message!)}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">{t('code')}</Label>
        <div className="flex gap-2">
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            placeholder={t('codePlaceholder')}
            {...register('code')}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={countdown > 0 || sendingCode}
            onClick={handleSendCode}
          >
            {countdown > 0 ? t('resendCode', { seconds: countdown }) : t('sendCode')}
          </Button>
        </div>
        {errors.code && (
          <p className="text-xs text-destructive">{resolveError(errors.code.message!)}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{resolveError(errors.password.message!)}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{resolveError(errors.confirmPassword.message!)}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('registerBtn')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('toLogin')}
        </Link>
      </p>
    </form>
  )
}
