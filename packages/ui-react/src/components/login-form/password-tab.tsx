/**
 * PasswordLoginForm — 共享密码登录子表单(2026-07-26 立)
 *
 * 抽到 packages/ui-react,web + extension 共用同一份组件。
 * 视觉规范(对齐 web 端原 PasswordLoginForm 2026-07-21 修订):
 *   - 账号 + 密码 + 提交按钮(space-y-4 pt-2)
 *   - 密码输入框用共享 PasswordInput(show/hide 切换)
 *   - 顶部 alert(服务端错误)
 *   - h-10 输入框 + h-10 提交按钮
 *   - 邮箱/手机号 简单验证(非空即可,具体格式校验在 apiClient 内部做)
 *
 * 共享包不依赖 next-intl / zod / react-hook-form:
 *   - 校验:基本格式(空校验),具体格式校验由 apiClient 内部做
 *   - 状态:useState,不用 react-hook-form
 *   - 翻译:用 props.t 函数
 */
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Input, Label } from '../../index'
import { Alert } from './alert'
import { PasswordInput } from './password-input'
import type { LoginApiClient, LoginResult, TFunc } from './types'

interface PasswordLoginFormProps {
  active: boolean
  apiClient: LoginApiClient
  t: TFunc
  onSuccess?: (data: NonNullable<LoginResult['data']>) => void | Promise<void>
  /** 输入框 placeholder,i18n key 'auth.accountPlaceholder' */
  accountPlaceholder?: string
  /** "忘记密码"链接回调(web 端切换到 forgot 模式,extension 跳网页) */
  onForgotPassword?: () => void
  /** 输入框 className,默认 h-10 */
  inputClassName?: string
  /** 提交按钮 className,默认 h-10 w-full */
  buttonClassName?: string
}

export function PasswordLoginForm({
  active,
  apiClient,
  t,
  onSuccess,
  accountPlaceholder,
  onForgotPassword,
  inputClassName = 'h-10',
  buttonClassName = 'h-10 w-full',
}: PasswordLoginFormProps) {
  const [account, setAccount] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!active) setError(null)
  }, [active])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!account || !password) {
      setError(t('auth.invalidCredentials'))
      return
    }
    setSubmitting(true)
    try {
      const result = await apiClient.loginByAccount(account, password)
      if (!result.success || !result.data) {
        setError(result.error || t('auth.loginFailed'))
        return
      }
      await onSuccess?.(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2" data-testid="password-login-form">
      {error && <Alert variant="danger" description={error} />}
      <div className="space-y-1.5">
        <Label htmlFor="lf-account">{t('auth.account')}</Label>
        <Input
          id="lf-account"
          type="text"
          autoComplete="username"
          placeholder={accountPlaceholder ?? t('auth.accountPlaceholder')}
          className={inputClassName}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="lf-password">{t('auth.password')}</Label>
          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {t('auth.forgotPassword')}
            </button>
          )}
        </div>
        <PasswordInput
          id="lf-password"
          autoComplete="current-password"
          placeholder={t('auth.passwordPlaceholder')}
          className={inputClassName}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          showLabel={t('a11y.showPassword')}
          hideLabel={t('a11y.hidePassword')}
        />
      </div>
      <Button
        type="submit"
        className={buttonClassName}
        disabled={submitting}
        data-testid="password-login-submit"
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('auth.loginBtn')}
      </Button>
    </form>
  )
}
