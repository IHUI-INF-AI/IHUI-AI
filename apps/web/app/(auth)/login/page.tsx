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
import { useAuthStore } from '@/stores/auth'

const phoneSchema = z
  .string()
  .min(1, 'auth.invalidPhone')
  .regex(/^1[3-9]\d{9}$/, 'auth.invalidPhone')

const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6, 'auth.invalidPassword'),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)

  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  })

  const resolveError = (key: string) => {
    if (key === 'auth.invalidPhone') return t('invalidPhone')
    if (key === 'auth.invalidPassword') return t('invalidPassword')
    return key
  }

  const onSubmit = async (values: LoginValues) => {
    setServerError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const json = (await res.json()) as {
        code: number
        message: string
        data?: { token?: string; user?: { id: string; nickname: string; avatar?: string } }
      }
      if (!res.ok || json.code !== 0 || !json.data?.token) {
        setServerError(json.message || t('loginFailed'))
        return
      }
      setToken(json.data.token)
      if (json.data.user) {
        setUser(json.data.user)
      }
      router.push('/')
    } catch {
      setServerError(t('loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
      <div className="space-y-1.5 text-center">
        <h2 className="text-xl font-semibold tracking-tight">{t('loginTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
      </div>

      {serverError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('password')}</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {t('forgotPassword')}
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{resolveError(errors.password.message!)}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t('thirdPartyLogin')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" disabled>
          {t('wechatLogin')}
        </Button>
        <Button type="button" variant="outline" disabled>
          {t('googleLogin')}
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t('registerNow')}
        </Link>
      </p>
    </form>
  )
}
