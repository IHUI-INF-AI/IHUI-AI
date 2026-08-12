'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '../button'
import { Input } from '../input'
import { Label } from '../label'
import { cn } from '../../lib/utils'
import { AgreementCheckbox } from './agreement-checkbox'
import { AccountHistoryInput } from './account-history-input'
import { isValidEmail, isValidPhone } from './types'
import { saveLoginHistory } from '../../lib/remember-credentials'
import type { ApiResult, LoginApiClient, LoginResult } from './types'

export type CodeLoginAccountType = 'email' | 'phone'

export interface CodeLoginFormProps {
  /** 账号类型:email / phone */
  accountType: CodeLoginAccountType
  /** i18n 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string
  /** 登录 API 客户端 */
  apiClient: LoginApiClient
  /** 登录成功回调 */
  onSuccess?: (result: LoginResult) => void | Promise<void>
  /** 协议状态 */
  agreed?: boolean
  onAgreedChange?: (v: boolean) => void
  /** 未勾选协议时调用 */
  onRequireAgree?: () => void
  showAgreeErr?: boolean
  /** 自定义样式 */
  inputClassName?: string
  buttonClassName?: string
  /**
   * 是否启用账号历史持久化(2026-07-30 立:消除 password/email/phone 3 个 tab 功能差异)
   * true 时账号输入框带历史下拉,登录成功后保存到 localStorage。
   */
  enableCredentialPersistence?: boolean
}

/**
 * 验证码登录表单通用实现(2026-08-12 由 EmailCodeLoginForm / PhoneCodeLoginForm 合并)。
 *
 * 原两表单 90% 相同,仅账号字段 / 校验 / API / input 属性 / i18n key 不同。
 * 统一为 accountType 参数化组件,EmailCodeLoginForm / PhoneCodeLoginForm 保留为薄 wrapper
 * 以维持导出 API 与 LoginForm tab 切换调用不变。
 */
export function CodeLoginForm({
  accountType,
  t,
  apiClient,
  onSuccess,
  agreed = true,
  onAgreedChange,
  onRequireAgree,
  showAgreeErr,
  inputClassName,
  buttonClassName,
  enableCredentialPersistence = false,
}: CodeLoginFormProps) {
  const isEmail = accountType === 'email'
  const isValid = isEmail ? isValidEmail : isValidPhone
  const invalidKey = isEmail ? 'auth.invalidEmail' : 'auth.invalidPhone'
  const accountKey = isEmail ? 'auth.email' : 'auth.phone'
  const placeholderKey = isEmail ? 'auth.emailPlaceholder' : 'auth.phonePlaceholder'
  const inputType = isEmail ? 'email' : 'tel'
  const autoComplete = isEmail ? 'email' : 'tel'
  const inputName = isEmail ? 'email' : 'tel'
  const testIdPrefix = isEmail ? 'email' : 'phone'
  const historyId = isEmail ? 'login-form-email' : 'login-form-phone'
  const historyType = isEmail ? 'email' : 'tel'
  const historyAutoComplete = isEmail ? 'email' : 'tel'

  const [account, setAccount] = React.useState('')
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [countdown, setCountdown] = React.useState(0)
  const [sending, setSending] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const countdownTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  React.useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }
  }, [])

  const startCountdown = () => {
    setCountdown(60)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    countdownTimerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const onSendCode = async () => {
    setError(null)
    if (!isValid(account)) {
      setError(t(invalidKey))
      return
    }
    setSending(true)
    try {
      // 手机号走 sendSmsCode,邮箱走 sendEmailCode(保持原有 API 契约不变)
      const result: ApiResult<{ sent: boolean }> = isEmail
        ? await apiClient.sendEmailCode(account)
        : await apiClient.sendSmsCode(account)
      if (!result.success) {
        setError(result.error || t('auth.loginFailed'))
        return
      }
      startCountdown()
    } catch {
      setError(t('auth.loginFailed'))
    } finally {
      setSending(false)
    }
  }

  const handleAccountChange = (v: string) => {
    // 手机号过滤非数字并限 11 位,邮箱原样(保持原各表单行为)
    setAccount(isEmail ? v : v.replace(/\D/g, '').slice(0, 11))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!agreed) {
      onRequireAgree?.()
      return
    }
    if (!isValid(account)) {
      setError(t(invalidKey))
      return
    }
    if (code.length !== 6) {
      setError(t('auth.enterCode'))
      return
    }
    setSubmitting(true)
    try {
      // 手机号走 loginBySms,邮箱走 loginByEmailCode(保持原有 API 契约不变)
      const result: ApiResult<LoginResult> = isEmail
        ? await apiClient.loginByEmailCode(account, code)
        : await apiClient.loginBySms(account, code)
      if (!result.success || !result.data?.accessToken) {
        setError(result.error || t('auth.loginFailed'))
        return
      }
      // 2026-07-30:登录成功后保存账号历史(与 password/email/phone tab 共用同一份 localStorage)
      if (enableCredentialPersistence) saveLoginHistory(account)
      await onSuccess?.(result.data)
    } catch {
      setError(t('auth.loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        // 兜底:Radix Dialog/Portal 内浏览器 implicit form submission 在某些场景失效
        // (实测:input 上按 Enter 不触发 form submit,但 form.requestSubmit() 能正常触发)。
        // 详见 password-login-form.tsx 同段注释。AgreementCheckbox 自身 onKeyDown
        // 已处理 Enter(标签 target 不是 INPUT,不进入此分支,避免重复 requestSubmit)。
        if (
          e.key === 'Enter' &&
          !e.shiftKey &&
          !e.nativeEvent.isComposing &&
          (e.target as HTMLElement).tagName === 'INPUT'
        ) {
          e.preventDefault()
          e.currentTarget.requestSubmit()
        }
      }}
      className="space-y-4 pt-2"
      noValidate
    >
      {error && <ErrorAlert message={error} />}

      <div className="space-y-1.5">
        <Label htmlFor={historyId}>{t(accountKey)}</Label>
        {enableCredentialPersistence ? (
          <AccountHistoryInput
            t={t}
            id={historyId}
            type={historyType}
            autoComplete={historyAutoComplete}
            placeholder={t(placeholderKey)}
            inputClassName={cn('h-10', inputClassName)}
            value={account}
            onChange={handleAccountChange}
            disabled={submitting}
            ariaLabel={t(accountKey)}
            active={!submitting}
          />
        ) : (
          <Input
            id={historyId}
            name={inputName}
            type={inputType}
            autoComplete={autoComplete}
            placeholder={t(placeholderKey)}
            className={cn('h-10', inputClassName)}
            value={account}
            onChange={(e) => handleAccountChange(e.target.value)}
            disabled={submitting}
            data-testid={`login-${testIdPrefix}-input`}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${historyId}-code`}>{t('auth.code')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${historyId}-code`}
            name="otp"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder={t('auth.codePlaceholder')}
            className={cn('h-10 flex-1', inputClassName)}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={submitting}
            data-testid={`login-${testIdPrefix}-code-input`}
          />
          <Button
            type="button"
            variant="outline"
            className={cn('h-10 shrink-0 px-3 text-sm', buttonClassName)}
            disabled={sending || countdown > 0}
            onClick={() => void onSendCode()}
            data-testid={`login-${testIdPrefix}-send-code`}
          >
            {countdown > 0
              ? t('auth.resendCode', { seconds: countdown })
              : t('auth.getVerificationCode')}
          </Button>
        </div>
      </div>

      <AgreementCheckbox
        t={t}
        checked={agreed}
        onChange={(v) => onAgreedChange?.(v)}
        error={showAgreeErr && !agreed}
      />
      {showAgreeErr && !agreed && (
        <p className="text-xs text-destructive">{t('auth.agreeRequired')}</p>
      )}

      <Button
        type="submit"
        className={cn('h-10 w-full', buttonClassName)}
        disabled={submitting}
        data-testid="login-submit"
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {t('auth.loginBtn')}
      </Button>
    </form>
  )
}

/** 错误提示(共享 Alert 样式) */
function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500"
    >
      <span className="shrink-0 leading-none">⚠</span>
      <span className="flex-1">{message}</span>
    </div>
  )
}
