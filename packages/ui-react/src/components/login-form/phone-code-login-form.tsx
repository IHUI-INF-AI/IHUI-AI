'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '../button'
import { Input } from '../input'
import { Label } from '../label'
import { cn } from '../../lib/utils'
import { AgreementCheckbox } from './agreement-checkbox'
import { isValidPhone } from './types'
import type { ApiResult, LoginApiClient, LoginResult } from './types'

export interface PhoneCodeLoginFormProps {
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
}

/**
 * 手机验证码登录表单(2026-07-26 抽取到共享包)
 *
 * 视觉规范(对标 web 端 PhoneCodeLoginForm.tsx):
 *   - 容器:space-y-4 pt-2
 *   - 手机号 Input h-10 + Label
 *   - 验证码 Input + 右侧"获取验证码"/"Ns 后重发" Button
 *   - 协议复选框
 *   - submit Button h-10 w-full + loading
 *
 * 共享包关键差异(2026-07-26):
 *   - 用 useState 管表单
 *   - 6 位 OTP 用单一 input
 *   - 倒计时 60s,unmount 时清理 interval 防内存泄漏
 */
export function PhoneCodeLoginForm({
  t,
  apiClient,
  onSuccess,
  agreed = true,
  onAgreedChange,
  onRequireAgree,
  showAgreeErr,
  inputClassName,
  buttonClassName,
}: PhoneCodeLoginFormProps) {
  const [phone, setPhone] = React.useState('')
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
    if (!isValidPhone(phone)) {
      setError(t('auth.invalidPhone'))
      return
    }
    setSending(true)
    try {
      const result: ApiResult<{ sent: boolean }> = await apiClient.sendSmsCode(phone)
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!agreed) {
      onRequireAgree?.()
      return
    }
    if (!isValidPhone(phone)) {
      setError(t('auth.invalidPhone'))
      return
    }
    if (code.length !== 6) {
      setError(t('auth.enterCode'))
      return
    }
    setSubmitting(true)
    try {
      const result: ApiResult<LoginResult> = await apiClient.loginBySms(phone, code)
      if (!result.success || !result.data?.accessToken) {
        setError(result.error || t('auth.loginFailed'))
        return
      }
      await onSuccess?.(result.data)
    } catch {
      setError(t('auth.loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2" noValidate>
      {error && <ErrorAlert message={error} />}

      <div className="space-y-1.5">
        <Label htmlFor="login-form-phone">{t('auth.phone')}</Label>
        <Input
          id="login-form-phone"
          name="tel"
          type="tel"
          autoComplete="tel"
          placeholder={t('auth.phonePlaceholder')}
          className={cn('h-10', inputClassName)}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
          disabled={submitting}
          data-testid="login-phone-input"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-form-phone-code">{t('auth.code')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="login-form-phone-code"
            name="otp"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder={t('auth.codePlaceholder')}
            className={cn('h-10 flex-1', inputClassName)}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={submitting}
            data-testid="login-phone-code-input"
          />
          <Button
            type="button"
            variant="outline"
            className={cn('h-10 shrink-0 px-3 text-sm', buttonClassName)}
            disabled={sending || countdown > 0}
            onClick={() => void onSendCode()}
            data-testid="login-phone-send-code"
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
