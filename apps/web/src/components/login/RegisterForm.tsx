'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label, Checkbox } from '@ihui/ui'
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator'

const registerSchema = z
  .object({
    username: z.string().min(3, 'auth.invalidUsername'),
    password: z.string().min(6, 'auth.invalidPassword'),
    confirmPassword: z.string().min(6, 'auth.invalidPassword'),
    agreement: z.literal(true, { errorMap: () => ({ message: 'auth.agreeRequired' }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  })

type RegisterValues = z.infer<typeof registerSchema>

/**
 * 注册表单：用户名 + 密码 + 确认密码 + 协议勾选，含密码强度实时检测。
 */
export function RegisterForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [serverInfo, setServerInfo] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema as never),
    defaultValues: { username: '', password: '', confirmPassword: '', agreement: false as unknown as true },
  })

  const password = watch('password')

  const resolveError = (key: string) => {
    const map: Record<string, string> = {
      'auth.invalidUsername': t('invalidUsername'),
      'auth.invalidPassword': t('invalidPassword'),
      'auth.passwordMismatch': t('passwordMismatch'),
      'auth.agreeRequired': t('agreeRequired'),
    }
    return map[key] ?? key
  }

  const onSubmit = async (values: RegisterValues) => {
    setServerError(null)
    setServerInfo(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: values.username, password: values.password }),
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</div>
      )}
      {serverInfo && (
        <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{serverInfo}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reg-username">{t('username')}</Label>
        <Input id="reg-username" autoComplete="username" placeholder={t('usernamePlaceholder')} {...register('username')} />
        {errors.username && <p className="text-xs text-destructive">{resolveError(errors.username.message!)}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password">{t('password')}</Label>
        <Input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          {...register('password')}
        />
        <PasswordStrengthIndicator password={password} />
        {errors.password && <p className="text-xs text-destructive">{resolveError(errors.password.message!)}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-confirm">{t('confirmPassword')}</Label>
        <Input
          id="reg-confirm"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{resolveError(errors.confirmPassword.message!)}</p>
        )}
      </div>

      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Controller
          control={control}
          name="agreement"
          render={({ field }) => (
            <Checkbox
              className="mt-0.5"
              checked={field.value as boolean}
              onCheckedChange={(v) => field.onChange(v)}
            />
          )}
        />
        <span>
          {t('agreePrefix')}{' '}
          <Link href="/terms-of-service" className="text-primary hover:underline" target="_blank">
            {t('termsOfService')}
          </Link>{' '}
          {t('and')}{' '}
          <Link href="/privacy-policy" className="text-primary hover:underline" target="_blank">
            {t('privacyPolicy')}
          </Link>
        </span>
      </div>
      {errors.agreement && <p className="text-xs text-destructive">{resolveError(errors.agreement.message!)}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('registerBtn')}
      </Button>
    </form>
  )
}
