'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Loader2, Check } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui-react'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { CaptchaCanvas, PasswordInput } from '@/components/login'
import { Alert } from '@/components/feedback'
import { AgreementCheckbox } from '@/components/auth/AgreementCheckbox'
import {
  loadRememberedCredentials,
  saveRememberedCredentials,
  clearRememberedCredentials,
  loadAutoLogin,
  saveAutoLogin,
  clearAutoLogin,
  saveLoginHistory,
} from '@/lib/remember-credentials'
import { loginSchema, type LoginValues } from './login-schemas'
import { AccountHistoryInput } from './AccountHistoryInput'

interface PasswordLoginFormProps {
  active: boolean
  onSuccess?: () => void
  agreed?: boolean
  onAgreedChange?: (v: boolean) => void
  onRequireAgree?: () => void
  showAgreeErr?: boolean
}

/** 统一复选框样式(16x16 方形 rounded-[4px]) */
function MiniCheckbox({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  testId: string
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2 select-none">
      <span
        onClick={(e) => {
          e.preventDefault()
          onChange(!checked)
        }}
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-200',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background group-hover:border-foreground/60',
        ].join(' ')}
        aria-checked={checked}
        role="checkbox"
        tabIndex={0}
        data-testid={testId}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        tabIndex={-1}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-xs leading-5 text-muted-foreground">{label}</span>
    </label>
  )
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
  const setTokenWithPrefs = useAuthStore((s) => s.setTokenWithPrefs)
  const setUser = useAuthStore((s) => s.setUser)

  const [serverError, setServerError] = React.useState<string | null>(null)
  const [captchaValue, setCaptchaValue] = React.useState('')
  const [captchaOk, setCaptchaOk] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // 记住密码:初始化时从 localStorage 读取已保存凭据
  const remembered = React.useMemo(() => loadRememberedCredentials(), [])
  const [rememberPassword, setRememberPassword] = React.useState(!!remembered)
  const [autoLogin, setAutoLogin] = React.useState(loadAutoLogin() && !!remembered)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      account: remembered?.account ?? '',
      password: remembered?.password ?? '',
    },
  })

  const account = watch('account')

  React.useEffect(() => {
    if (!active) setServerError(null)
  }, [active])

  // 表单激活时重新读取已保存凭据(解决 Dialog 预挂载导致 defaultValues 为空)
  React.useEffect(() => {
    if (active) {
      const saved = loadRememberedCredentials()
      if (saved) {
        setValue('account', saved.account)
        setValue('password', saved.password)
      }
    }
  }, [active, setValue])

  const resolveError = (key: string) => {
    if (key === 'auth.invalidAccount') return t('invalidAccount')
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
        body: JSON.stringify({ account: values.account, password: values.password }),
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
      // 登录成功:保存/清除凭据 + 账号历史 + 自动登录标志
      if (rememberPassword) {
        saveRememberedCredentials(values.account, values.password)
      } else {
        clearRememberedCredentials()
        if (autoLogin) {
          setAutoLogin(false)
          clearAutoLogin()
        }
      }
      saveAutoLogin(autoLogin && rememberPassword)
      saveLoginHistory(values.account)
      // 用 setTokenWithPrefs:autoLogin=true 时 refreshToken cookie max-age=30d,
      // 浏览器关闭再打开仍能保持登录(自动登录闭环)
      setTokenWithPrefs(
        json.data.accessToken,
        json.data.refreshToken ?? '',
        autoLogin && rememberPassword,
      )
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
      {/* 账号输入框 + 历史下拉 */}
      <div className="space-y-1.5">
        <Label htmlFor="account">{t('account')}</Label>
        <AccountHistoryInput
          id="account"
          type="text"
          autoComplete="username"
          placeholder={t('accountPlaceholder')}
          className="h-10"
          value={account}
          onChange={(v) => setValue('account', v)}
          onSelect={(v) => {
            if (remembered?.account === v) setValue('password', remembered.password)
          }}
          active={active}
        />
        {errors.account && (
          <p className="text-xs text-destructive">{resolveError(errors.account.message!)}</p>
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
        <PasswordInput
          id="password"
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
      {/* 记住密码 + 自动登录:验证码下方同一排 */}
      <div className="flex items-center justify-between">
        <MiniCheckbox
          checked={rememberPassword}
          onChange={(v) => {
            setRememberPassword(v)
            if (!v) {
              setAutoLogin(false)
            }
          }}
          label={t('rememberPassword')}
          testId="remember-password-checkbox"
        />
        <MiniCheckbox
          checked={autoLogin}
          onChange={(v) => {
            if (v && !rememberPassword) {
              setRememberPassword(true)
            }
            setAutoLogin(v)
          }}
          label={t('autoLogin')}
          testId="auto-login-checkbox"
        />
      </div>
      <AgreementCheckbox
        checked={agreed}
        onChange={(v) => onAgreedChange?.(v)}
        error={showAgreeErr && !agreed}
      />
      {showAgreeErr && !agreed && <p className="text-xs text-destructive">{t('agreeRequired')}</p>}
      <Button type="submit" className="h-10 w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('loginBtn')}
      </Button>
    </form>
  )
}
