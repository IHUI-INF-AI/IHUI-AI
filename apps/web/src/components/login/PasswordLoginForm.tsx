'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Loader2, Check, ChevronDown, X } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui'
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
  loadLoginHistory,
  saveLoginHistory,
  removeFromLoginHistory,
  clearLoginHistory,
} from '@/lib/remember-credentials'
import { loginSchema, type LoginValues } from './login-schemas'

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

  // 账号历史下拉(useState 而非 useMemo,active 时重新读取 + 登录成功后实时更新)
  const [showHistory, setShowHistory] = React.useState(false)
  const [loginHistory, setLoginHistory] = React.useState<string[]>(() => loadLoginHistory())
  const [activeHistoryIndex, setActiveHistoryIndex] = React.useState(-1)
  const accountInputRef = React.useRef<HTMLInputElement | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      account: remembered?.account ?? '',
      password: remembered?.password ?? '',
    },
  })

  // 分离 RHF ref 和本地 ref,避免覆盖导致 setValue 无法更新 DOM
  const { ref: rhfAccountRef, ...accountReg } = register('account')

  React.useEffect(() => {
    if (!active) setServerError(null)
  }, [active])

  // 表单激活时重新读取已保存凭据 + 账号历史(解决 Dialog 预挂载导致 defaultValues / loginHistory 为空)
  React.useEffect(() => {
    if (active) {
      const saved = loadRememberedCredentials()
      if (saved) {
        setValue('account', saved.account)
        setValue('password', saved.password)
      }
      setLoginHistory(loadLoginHistory())
    }
  }, [active, setValue])

  // 点击外部关闭历史下拉
  React.useEffect(() => {
    if (!showHistory) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-account-history-container]')) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showHistory])

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
      setLoginHistory(loadLoginHistory())
      // 用 setTokenWithPrefs:autoLogin=true 时 refreshToken cookie max-age=30d,
      // 浏览器关闭再打开仍能保持登录(自动登录闭环)
      setTokenWithPrefs(
        json.data.accessToken,
        json.data.refreshToken ?? null,
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
        <div className="relative" data-account-history-container>
          <Input
            id="account"
            type="text"
            autoComplete="username"
            placeholder={t('accountPlaceholder')}
            className="h-10"
            {...accountReg}
            ref={(el) => {
              rhfAccountRef(el)
              accountInputRef.current = el
            }}
            onDoubleClick={(e) => {
              e.preventDefault()
              setShowHistory((v) => {
                if (!v) setActiveHistoryIndex(-1)
                return !v
              })
            }}
            onKeyDown={(e) => {
              if (!showHistory || loginHistory.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveHistoryIndex((i) => (i + 1) % loginHistory.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveHistoryIndex((i) => (i - 1 + loginHistory.length) % loginHistory.length)
              } else if (e.key === 'Enter' && activeHistoryIndex >= 0) {
                e.preventDefault()
                const selected = loginHistory[activeHistoryIndex]
                if (selected) {
                  setValue('account', selected)
                  if (remembered?.account === selected) {
                    setValue('password', remembered.password)
                  }
                  setShowHistory(false)
                  setActiveHistoryIndex(-1)
                  accountInputRef.current?.focus()
                }
              } else if (e.key === 'Escape') {
                setShowHistory(false)
                setActiveHistoryIndex(-1)
              }
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setShowHistory((v) => {
                if (!v) setActiveHistoryIndex(-1)
                return !v
              })
            }}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={t('accountHistory')}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
          {showHistory && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
              {loginHistory.length > 0 ? (
                <>
                  {loginHistory.map((account, idx) => (
                    <div
                      key={account}
                      data-history-index={idx}
                      onMouseEnter={() => setActiveHistoryIndex(idx)}
                      onClick={() => {
                        setValue('account', account)
                        if (remembered?.account === account) {
                          setValue('password', remembered.password)
                        }
                        setShowHistory(false)
                        setActiveHistoryIndex(-1)
                        accountInputRef.current?.focus()
                      }}
                      className={[
                        'flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                        activeHistoryIndex === idx
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground',
                      ].join(' ')}
                    >
                      <span className="truncate">{account}</span>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation()
                          setLoginHistory(removeFromLoginHistory(account))
                          if (loginHistory.length <= 1) {
                            setShowHistory(false)
                          }
                        }}
                        className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t('removeAccount')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      clearLoginHistory()
                      setLoginHistory([])
                      setShowHistory(false)
                      setActiveHistoryIndex(-1)
                    }}
                    className="mt-1 w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {t('clearHistory')}
                  </button>
                </>
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">{t('noHistory')}</div>
              )}
            </div>
          )}
        </div>
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
