'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { ThirdPartyLoginButtons, CaptchaCanvas, QrCodeLogin } from '@/components/login'

const phoneSchema = z
  .string()
  .min(1, 'auth.invalidPhone')
  .regex(/^1[3-9]\d{9}$/, 'auth.invalidPhone')

const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6, 'auth.invalidPassword'),
})

type LoginValues = z.infer<typeof loginSchema>

const emailSchema = z.string().email('auth.invalidEmail')
const usernameSchema = z.string().min(3, 'auth.invalidUsername')

type TokenResult = { userId: string; accessToken: string; refreshToken: string; tokenType: string }

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)

  const [serverError, setServerError] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<'password' | 'email' | 'username' | 'qr'>('password')
  const [captchaValue, setCaptchaValue] = React.useState('')
  const [captchaOk, setCaptchaOk] = React.useState(false)

  // ===== Tab 1: 手机号 + 密码 (现有) =====
  const [submitting, setSubmitting] = React.useState(false)
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

  const onPasswordSubmit = async (values: LoginValues) => {
    setServerError(null)
    if (!captchaOk) {
      setServerError(t('captchaPlaceholder'))
      return
    }
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
      if (json.data.user) setUser(json.data.user)
      router.push('/')
    } catch {
      setServerError(t('loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // ===== Tab 2: 邮箱 + 验证码 =====
  const [email, setEmail] = React.useState('')
  const [emailCode, setEmailCode] = React.useState('')
  const [emailErr, setEmailErr] = React.useState<string | null>(null)
  const [emailCountdown, setEmailCountdown] = React.useState(0)
  const [sendingEmail, setSendingEmail] = React.useState(false)
  const [emailSubmitting, setEmailSubmitting] = React.useState(false)

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

  // ===== Tab 3: 用户名 + 密码 =====
  const [username, setUsername] = React.useState('')
  const [usernamePassword, setUsernamePassword] = React.useState('')
  const [usernameErr, setUsernameErr] = React.useState<string | null>(null)
  const [usernameSubmitting, setUsernameSubmitting] = React.useState(false)

  const onUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUsernameErr(null)
    const up = usernameSchema.safeParse(username)
    if (!up.success) {
      setUsernameErr(t('invalidUsername'))
      return
    }
    if (usernamePassword.length < 6) {
      setUsernameErr(t('invalidPassword'))
      return
    }
    setUsernameSubmitting(true)
    try {
      const res = await fetch('/api/auth/login/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: usernamePassword }),
      })
      const json = (await res.json()) as { code: number; message: string; data?: TokenResult }
      if (!res.ok || json.code !== 0 || !json.data?.accessToken) {
        setUsernameErr(json.message || t('invalidCredentials'))
        return
      }
      setToken(json.data.accessToken)
      router.push('/')
    } catch {
      setUsernameErr(t('loginFailed'))
    } finally {
      setUsernameSubmitting(false)
    }
  }

  // ===== 第三方登录（由 ThirdPartyLoginButtons 组件处理） =====

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1.5 text-center">
        <h2 className="text-xl font-semibold tracking-tight">{t('loginTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setServerError(null); setUsernameErr(null); setEmailErr(null) }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="password">{t('passwordLogin')}</TabsTrigger>
          <TabsTrigger value="email">{t('emailLogin')}</TabsTrigger>
          <TabsTrigger value="username">{t('usernameLogin')}</TabsTrigger>
          <TabsTrigger value="qr">{t('qrLogin')}</TabsTrigger>
        </TabsList>

        {/* 手机号 + 密码 */}
        <TabsContent value="password">
          <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4 pt-2">
            {serverError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input id="phone" type="tel" autoComplete="tel" placeholder={t('phonePlaceholder')} {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{resolveError(errors.phone.message!)}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('password')}</Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
                  {t('forgotPassword')}
                </Link>
              </div>
              <Input id="password" type="password" autoComplete="current-password" placeholder={t('passwordPlaceholder')} {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{resolveError(errors.password.message!)}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="captcha">{t('captcha')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="captcha"
                  placeholder={t('captchaPlaceholder')}
                  autoComplete="off"
                  value={captchaValue}
                  onChange={(e) => setCaptchaValue(e.target.value)}
                />
                <CaptchaCanvas value={captchaValue} onVerify={setCaptchaOk} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('loginBtn')}
            </Button>
          </form>
        </TabsContent>

        {/* 邮箱 + 验证码 */}
        <TabsContent value="email">
          <form onSubmit={onEmailSubmit} className="space-y-4 pt-2">
            {emailErr && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{emailErr}</div>}
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" autoComplete="email" placeholder={t('emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-code">{t('code')}</Label>
              <div className="flex gap-2">
                <Input id="email-code" placeholder={t('codePlaceholder')} value={emailCode} onChange={(e) => setEmailCode(e.target.value)} />
                <Button type="button" variant="outline" className="shrink-0" disabled={sendingEmail || emailCountdown > 0} onClick={onSendEmailCode}>
                  {emailCountdown > 0 ? t('resendCode', { seconds: emailCountdown }) : t('sendEmailCode')}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={emailSubmitting}>
              {emailSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('loginBtn')}
            </Button>
          </form>
        </TabsContent>

        {/* 用户名 + 密码 */}
        <TabsContent value="username">
          <form onSubmit={onUsernameSubmit} className="space-y-4 pt-2">
            {usernameErr && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{usernameErr}</div>}
            <div className="space-y-2">
              <Label htmlFor="username">{t('username')}</Label>
              <Input id="username" autoComplete="username" placeholder={t('usernamePlaceholder')} value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username-password">{t('password')}</Label>
              <Input id="username-password" type="password" autoComplete="current-password" placeholder={t('passwordPlaceholder')} value={usernamePassword} onChange={(e) => setUsernamePassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={usernameSubmitting}>
              {usernameSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('loginBtn')}
            </Button>
          </form>
        </TabsContent>

        {/* 扫码登录 */}
        <TabsContent value="qr">
          <QrCodeLogin onSwitchMethod={() => setTab('password')} />
        </TabsContent>
      </Tabs>

      <ThirdPartyLoginButtons />

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t('registerNow')}
        </Link>
      </p>
    </div>
  )
}
