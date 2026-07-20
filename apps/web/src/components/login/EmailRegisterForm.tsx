'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { PasswordStrengthIndicator } from '@/components/login'
import { emailSchema } from '@/components/login/login-schemas'
import { AgreementCheckbox } from '@/components/auth/AgreementCheckbox'
import { useLoginDialogStore } from '@/stores/login-dialog'

const emailRegisterSchema = z
  .object({
    email: emailSchema,
    code: z.string().length(6, 'auth.codePlaceholder'),
    password: z.string().min(6, 'auth.invalidPassword').max(64, 'auth.invalidPassword'),
    confirmPassword: z.string().min(6, 'auth.invalidPassword'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  })

type EmailRegisterValues = z.infer<typeof emailRegisterSchema>

interface EmailRegisterFormProps {
  onSuccess?: () => void
  agreed: boolean
  onAgreedChange: (v: boolean) => void
  showAgreeErr: boolean
  setShowAgreeErr: (v: boolean) => void
}

export function EmailRegisterForm({
  onSuccess,
  agreed,
  onAgreedChange,
  showAgreeErr,
  setShowAgreeErr,
}: EmailRegisterFormProps) {
  const t = useTranslations('auth')
  const setMode = useLoginDialogStore((s) => s.setMode)

  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [serverInfo, setServerInfo] = React.useState<string | null>(null)

  const [countdown, setCountdown] = React.useState(0)
  const [sendingCode, setSendingCode] = React.useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors },
  } = useForm<EmailRegisterValues>({
    resolver: zodResolver(emailRegisterSchema as never),
    defaultValues: { email: '', code: '', password: '', confirmPassword: '' },
  })

  const password = watch('password')

  const resolveError = (key: string) => {
    const map: Record<string, string> = {
      'auth.invalidEmail': t('invalidEmail'),
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
    const email = getValues('email')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setServerError(t('invalidEmail'))
      return
    }
    setServerError(null)
    setSendingCode(true)
    try {
      const res = await fetch('/api/auth/email/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, scene: 'register' }),
      })
      if (res.ok) {
        setServerInfo(t('codeSent'))
        setCountdown(60)
      } else {
        const json = (await res.json().catch(() => ({}))) as { message?: string }
        setServerError(json.message || t('registerFailed'))
      }
    } catch {
      setServerError(t('registerFailed'))
    } finally {
      setSendingCode(false)
    }
  }

  const onSubmit = async (values: EmailRegisterValues) => {
    setServerError(null)
    setServerInfo(null)
    if (!agreed) {
      setShowAgreeErr(true)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register/email', {
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
      setTimeout(() => onSuccess?.() ?? setMode('login'), 800)
    } catch {
      setServerError(t('registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && <Alert variant="danger" description={serverError} />}
      {serverInfo && <Alert variant="success" description={serverInfo} />}

      <div className="space-y-1.5">
        <Label htmlFor="email-register">{t('email')}</Label>
        <Input
          id="email-register"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          className="h-10"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{resolveError(errors.email.message!)}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email-register-code">{t('code')}</Label>
        <div className="flex gap-2">
          <Input
            id="email-register-code"
            type="text"
            inputMode="numeric"
            placeholder={t('codePlaceholder')}
            className="h-10 flex-1"
            {...register('code')}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0"
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

      <div className="space-y-1.5">
        <Label htmlFor="email-register-password">{t('password')}</Label>
        <Input
          id="email-register-password"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          className="h-10"
          {...register('password')}
        />
        <PasswordStrengthIndicator password={password} />
        {errors.password && (
          <p className="text-xs text-destructive">{resolveError(errors.password.message!)}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email-register-confirm">{t('confirmPassword')}</Label>
        <Input
          id="email-register-confirm"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          className="h-10"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {resolveError(errors.confirmPassword.message!)}
          </p>
        )}
      </div>

      <AgreementCheckbox
        checked={agreed}
        onChange={(v) => {
          onAgreedChange(v)
          if (v) setShowAgreeErr(false)
        }}
        error={showAgreeErr && !agreed}
      />
      {showAgreeErr && !agreed && <p className="text-xs text-destructive">{t('agreeRequired')}</p>}
      <Button type="submit" className="h-10 w-full" disabled={submitting || !agreed}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('registerBtn')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('hasAccount')}{' '}
        <button
          type="button"
          onClick={() => setMode('login')}
          className="font-medium text-primary hover:underline"
        >
          {t('toLogin')}
        </button>
      </p>
    </form>
  )
}
