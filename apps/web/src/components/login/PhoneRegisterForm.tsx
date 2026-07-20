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
import { AgreementCheckbox } from '@/components/auth/AgreementCheckbox'
import { useLoginDialogStore } from '@/stores/login-dialog'

const phoneRegisterSchema = z
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

type PhoneRegisterValues = z.infer<typeof phoneRegisterSchema>

interface PhoneRegisterFormProps {
  onSuccess?: () => void
  agreed: boolean
  onAgreedChange: (v: boolean) => void
  showAgreeErr: boolean
  setShowAgreeErr: (v: boolean) => void
}

export function PhoneRegisterForm({
  onSuccess,
  agreed,
  onAgreedChange,
  showAgreeErr,
  setShowAgreeErr,
}: PhoneRegisterFormProps) {
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
  } = useForm<PhoneRegisterValues>({
    resolver: zodResolver(phoneRegisterSchema as never),
    defaultValues: { phone: '', code: '', password: '', confirmPassword: '' },
  })

  const password = watch('password')

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

  const onSubmit = async (values: PhoneRegisterValues) => {
    setServerError(null)
    setServerInfo(null)
    if (!agreed) {
      setShowAgreeErr(true)
      return
    }
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
        <Label htmlFor="phone-register">{t('phone')}</Label>
        <Input
          id="phone-register"
          type="tel"
          autoComplete="tel"
          placeholder={t('phonePlaceholder')}
          className="h-10"
          {...register('phone')}
        />
        {errors.phone && (
          <p className="text-xs text-destructive">{resolveError(errors.phone.message!)}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone-register-code">{t('code')}</Label>
        <div className="flex gap-2">
          <Input
            id="phone-register-code"
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
        <Label htmlFor="phone-register-password">{t('password')}</Label>
        <Input
          id="phone-register-password"
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
        <Label htmlFor="phone-register-confirm">{t('confirmPassword')}</Label>
        <Input
          id="phone-register-confirm"
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
