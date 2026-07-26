/**
 * EmailCodeLoginForm — 共享邮箱验证码登录子表单(2026-07-26 立)
 *
 * 抽到 packages/ui-react,web + extension 共用同一份组件。
 * 视觉规范(对齐 web 端原 EmailCodeLoginForm 2026-07-22 立):
 *   - 邮箱 + 验证码(OTP 6 格)+ 获取验证码按钮(space-y-4 pt-2)
 *   - 验证码按钮 60s 倒计时,变体 outline,disabled 当 countdown > 0
 *   - 输入框 h-10,OTP h-11,提交按钮 h-10 w-full
 *   - 顶部 alert(服务端错误 / 邮箱格式错误)
 */
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Input, Label } from '../../index'
import { Alert } from './alert'
import { OtpInput } from './otp-input'
import type { LoginApiClient, LoginResult, TFunc } from './types'

interface EmailCodeLoginFormProps {
  active: boolean
  apiClient: LoginApiClient
  t: TFunc
  onSuccess?: (data: NonNullable<LoginResult['data']>) => void | Promise<void>
  inputClassName?: string
  buttonClassName?: string
}

export function EmailCodeLoginForm({
  active,
  apiClient,
  t,
  onSuccess,
  inputClassName = 'h-10',
  buttonClassName = 'h-10 w-full',
}: EmailCodeLoginFormProps) {
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)
  const [countdown, setCountdown] = React.useState(0)
  const [sending, setSending] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  React.useEffect(() => {
    if (!active) setErr(null)
  }, [active])

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startCountdown = () => {
    setCountdown(60)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const onSendCode = async () => {
    setErr(null)
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setErr(t('auth.invalidEmail'))
      return
    }
    setSending(true)
    try {
      const result = await apiClient.sendEmailCode(email)
      if (!result.success) {
        setErr(result.error || t('auth.loginFailed'))
        return
      }
      startCountdown()
    } catch {
      setErr(t('auth.loginFailed'))
    } finally {
      setSending(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setErr(t('auth.invalidEmail'))
      return
    }
    if (code.length !== 6) {
      setErr(t('auth.enterCode'))
      return
    }
    setSubmitting(true)
    try {
      const result = await apiClient.loginByEmailCode(email, code)
      if (!result.success || !result.data) {
        setErr(result.error || t('auth.loginFailed'))
        return
      }
      await onSuccess?.(result.data)
    } catch {
      setErr(t('auth.loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2" data-testid="email-code-login-form">
      {err && <Alert variant="danger" description={err} />}
      <div className="space-y-1.5">
        <Label htmlFor="lf-email">{t('auth.email')}</Label>
        <Input
          id="lf-email"
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          className={inputClassName}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('auth.code')}</Label>
        <div className="flex items-center gap-2">
          <OtpInput
            value={code}
            onChange={setCode}
            disabled={submitting}
            aria-label={t('auth.code')}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 px-3 text-sm"
            disabled={sending || countdown > 0}
            onClick={onSendCode}
            data-testid="email-send-code"
          >
            {countdown > 0
              ? t('auth.resendCode', { seconds: countdown })
              : t('auth.getVerificationCode')}
          </Button>
        </div>
      </div>
      <Button
        type="submit"
        className={buttonClassName}
        disabled={submitting}
        data-testid="email-login-submit"
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('auth.loginBtn')}
      </Button>
    </form>
  )
}
