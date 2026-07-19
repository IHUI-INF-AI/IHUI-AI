'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { CaptchaCanvas } from '@/components/login'
import { Alert } from '@/components/feedback'
import { AgreementCheckbox } from '@/components/auth/AgreementCheckbox'
import { loginSchema, type LoginValues } from './login-schemas'

interface PasswordLoginFormProps {
  active: boolean
  onSuccess?: () => void
  agreed?: boolean
  onAgreedChange?: (v: boolean) => void
  onRequireAgree?: () => void
  showAgreeErr?: boolean
}

export function PasswordLoginForm({
  active,
  onSuccess,
  agreed = true,
  onAgreedChange,
  onRequireAgree,
  showAgreeErr,
}: PasswordLoginFormProps) {
  const t = useTranslations('auth')
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)

  const [serverError, setServerError] = React.useState<string | null>(null)
  const [captchaValue, setCaptchaValue] = React.useState('')
  const [captchaOk, setCaptchaOk] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  })

  React.useEffect(() => {
    if (!active) setServerError(null)
  }, [active])

  const resolveError = (key: string) => {
    if (key === 'auth.invalidPhone') return t('invalidPhone')
    if (key === 'auth.invalidPassword') return t('invalidPassword')
    return key
  }

  const onPasswordSubmit = async (values: LoginValues) => {
    setServerError(null)
    if (!agreed) {
      onRequireAgree?.()
      return
    }
    if (!captchaOk) {
      setServerError(t('captchaPlaceholder'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: values.phone, password: values.password }),
      })
      const json = (await res.json()) as {
        code: number
        message: string
        data?: {
          accessToken?: string
          refreshToken?: string
          user?: { id: string; nickname: string; avatar?: string }
        }
      }
      if (!res.ok || json.code !== 0 || !json.data?.accessToken) {
        setServerError(json.message || t('loginFailed'))
        return
      }
      setToken(json.data.accessToken, json.data.refreshToken)
      if (json.data.user) setUser(json.data.user)
      onSuccess?.()
    } catch {
      setServerError(t('loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4 pt-2">
      {serverError && <Alert variant="danger" description={serverError} />}
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input
          id="phone"
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('password')}</Label>
          <button
            type="button"
            onClick={() => useLoginDialogStore.getState().open('forgot')}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {t('forgotPassword')}
          </button>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          className="h-10"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{resolveError(errors.password.message!)}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="captcha">{t('captcha')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="captcha"
            placeholder={t('captchaPlaceholder')}
            autoComplete="off"
            className="h-10 flex-1"
            value={captchaValue}
            onChange={(e) => setCaptchaValue(e.target.value)}
          />
          <CaptchaCanvas value={captchaValue} onVerify={setCaptchaOk} />
        </div>
      </div>
      <AgreementCheckbox
        checked={agreed}
        onChange={(v) => onAgreedChange?.(v)}
        error={showAgreeErr && !agreed}
      />
      {showAgreeErr && !agreed && <p className="text-xs text-destructive">{t('agreeRequired')}</p>}
      <Button type="submit" className="h-10 w-full" disabled={submitting || !agreed}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}
