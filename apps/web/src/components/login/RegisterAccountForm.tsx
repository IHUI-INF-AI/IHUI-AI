'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import {
  sendCode,
  sendEmailCode,
  register as registerByPhone,
  registerByEmail,
} from '@ihui/api-client'
import { PasswordInput, PasswordStrengthIndicator } from '@/components/login'
import { emailSchema } from '@/components/login/login-schemas'
import { AgreementCheckbox } from '@/components/auth/AgreementCheckbox'
import { useLoginDialogStore } from '@/stores/login-dialog'
// 跨端类型契约对齐(2026-07-29):仅引入共享类型,不替换 RHF 集成
// 详见 packages/shared/src/hooks/use-register-form.ts;mobile-rn / miniapp-taro 用 useRegisterForm,web 保留 RHF
import type { RegisterApiResult, SendCodeApiResult } from '@ihui/shared/hooks'

type AccountType = 'phone' | 'email'

export interface RegisterAccountFormProps {
  accountType: AccountType
  onSuccess?: () => void
  agreed: boolean
  onAgreedChange: (v: boolean) => void
  showAgreeErr: boolean
  setShowAgreeErr: (v: boolean) => void
}

interface RegisterAccountValues {
  account: string
  code: string
  password: string
  confirmPassword: string
}

const PHONE_RE = /^1[3-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 注册表单通用实现(2026-08-12 由 PhoneRegisterForm / EmailRegisterForm 合并)。
 *
 * 两表单原 90% 相同,仅 account 字段校验 / 发码 API / 注册 API / input 属性不同。
 * 统一为 accountType 参数化组件,PhoneRegisterForm / EmailRegisterForm 保留为薄 wrapper
 * 以维持导出 API 与 RegisterFormContent 调用不变。
 */
export function RegisterAccountForm({
  accountType,
  onSuccess,
  agreed,
  onAgreedChange,
  showAgreeErr,
  setShowAgreeErr,
}: RegisterAccountFormProps) {
  const t = useTranslations('auth')
  const setMode = useLoginDialogStore((s) => s.setMode)
  const isPhone = accountType === 'phone'

  const registerSchema = React.useMemo(
    () =>
      z
        .object({
          account: isPhone ? z.string().regex(PHONE_RE, 'auth.invalidPhone') : emailSchema,
          code: isPhone
            ? z.string().min(4, 'auth.codePlaceholder')
            : z.string().length(6, 'auth.codePlaceholder'),
          password: isPhone
            ? z.string().min(6, 'auth.invalidPassword')
            : z.string().min(6, 'auth.invalidPassword').max(64, 'auth.invalidPassword'),
          confirmPassword: z.string().min(6, 'auth.invalidPassword'),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'auth.passwordMismatch',
          path: ['confirmPassword'],
        }),
    [isPhone],
  )

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
  } = useForm<RegisterAccountValues>({
    resolver: zodResolver(registerSchema as never),
    defaultValues: { account: '', code: '', password: '', confirmPassword: '' },
  })

  const password = watch('password')

  const resolveError = (key: string) => {
    const map: Record<string, string> = {
      'auth.invalidPhone': t('invalidPhone'),
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
    const account = getValues('account')
    if (!(isPhone ? PHONE_RE : EMAIL_RE).test(account)) {
      setServerError(isPhone ? t('invalidPhone') : t('invalidEmail'))
      return
    }
    setServerError(null)
    setSendingCode(true)
    try {
      // phone 走通用 sendCode('phone',...),email 走 sendEmailCode(保持原有 API 契约不变)
      const r = isPhone
        ? await sendCode('phone', account, 'register')
        : await sendEmailCode(account, 'register')
      // 类型契约对齐:把 api-client 的 ApiResult<{ sent: boolean }> 映射为 @ihui/shared 的 SendCodeApiResult
      const sendCodeResult: SendCodeApiResult = r.success
        ? { success: true }
        : { success: false, error: r.error }
      if (sendCodeResult.success) {
        setServerInfo(t('codeSent'))
        setCountdown(60)
      } else {
        // email 版原实现展示 sendCodeResult.error,phone 版展示 registerFailed,保持各自行为
        setServerError(isPhone ? t('registerFailed') : sendCodeResult.error || t('registerFailed'))
      }
    } catch {
      setServerError(t('registerFailed'))
    } finally {
      setSendingCode(false)
    }
  }

  const onSubmit = async (values: RegisterAccountValues) => {
    setServerError(null)
    setServerInfo(null)
    if (!agreed) {
      setShowAgreeErr(true)
      return
    }
    setSubmitting(true)
    try {
      // phone 版参数顺序 (account, password, code),email 版 (account, code, password),保持原契约
      const r = isPhone
        ? await registerByPhone(values.account, values.password, values.code)
        : await registerByEmail(values.account, values.code, values.password)
      // 类型契约对齐:把 api-client 的 ApiResult<LoginResult> 映射为 @ihui/shared 的 RegisterApiResult
      const registerResult: RegisterApiResult = r.success
        ? {
            success: true,
            accessToken: r.data.accessToken,
            refreshToken: r.data.refreshToken,
            user: {
              id: r.data.user.id,
              nickname: r.data.user.nickname ?? '',
              avatar: r.data.user.avatar,
            },
          }
        : { success: false, error: r.error }
      if (!registerResult.success) {
        setServerError(registerResult.error || t('registerFailed'))
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

  const accountLabel = isPhone ? t('phone') : t('email')
  const accountPlaceholder = isPhone ? t('phonePlaceholder') : t('emailPlaceholder')
  const idPrefix = isPhone ? 'phone-register' : 'email-register'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && <Alert variant="danger" description={serverError} />}
      {serverInfo && <Alert variant="success" description={serverInfo} />}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-account`}>{accountLabel}</Label>
        <Input
          id={`${idPrefix}-account`}
          type={isPhone ? 'tel' : 'email'}
          autoComplete={isPhone ? 'tel' : 'email'}
          placeholder={accountPlaceholder}
          className="h-10"
          {...register('account')}
        />
        {errors.account && (
          <p className="text-xs text-destructive">{resolveError(errors.account.message!)}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-code`}>{t('code')}</Label>
        <div className="flex gap-2">
          <Input
            id={`${idPrefix}-code`}
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
        <Label htmlFor={`${idPrefix}-password`}>{t('password')}</Label>
        <PasswordInput
          id={`${idPrefix}-password`}
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
        <Label htmlFor={`${idPrefix}-confirm`}>{t('confirmPassword')}</Label>
        <PasswordInput
          id={`${idPrefix}-confirm`}
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
