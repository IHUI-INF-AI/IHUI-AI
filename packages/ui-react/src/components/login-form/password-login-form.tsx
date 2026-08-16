'use client'

import * as React from 'react'
import { Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react'

import { Button } from '../button'
import { Input } from '../input'
import { Label } from '../label'
import { Checkbox } from '../checkbox'
import { cn } from '../../lib/utils'
import { AgreementCheckbox } from './agreement-checkbox'
import { AccountHistoryInput } from './account-history-input'
import type { ApiResult, LoginApiClient, LoginResult } from './types'
import {
  saveRememberedCredentials,
  loadRememberedCredentials,
  clearRememberedCredentials,
  saveAutoLogin,
  loadAutoLogin,
  clearAutoLogin,
  saveLoginHistory,
} from '../../lib/remember-credentials'

export interface PasswordLoginFormProps {
  /** i18n 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string
  /** 登录 API 客户端 */
  apiClient: LoginApiClient
  /** 登录成功回调 */
  onSuccess?: (result: LoginResult) => void | Promise<void>
  /** 协议状态 */
  agreed?: boolean
  onAgreedChange?: (v: boolean) => void
  /** 未勾选协议时调用(父组件决定 inline 提示还是弹窗) */
  onRequireAgree?: () => void
  showAgreeErr?: boolean
  /** 是否需要图形验证码 */
  captchaEnabled?: boolean
  /** 自定义样式 */
  inputClassName?: string
  buttonClassName?: string
  /** 是否显示忘记密码链接 */
  showForgotPassword?: boolean
  onForgotPassword?: () => void
  forgotPasswordHref?: string
  /**
   * 是否启用凭据持久化(记住密码 + 自动登录 + 账号历史)
   * 2026-07-30 立:消除 web 端 B 版本与共享包 A 版本功能差异。
   * true 时:显示"记住密码/自动登录"checkbox + 账号输入框带历史下拉,
   *         登录成功后持久化到 localStorage。
   * false 时:向后兼容(不显示 checkbox,账号输入框普通 Input 无下拉)。
   */
  enableCredentialPersistence?: boolean
}

/**
 * 密码登录表单(2026-07-26 抽取到共享包,2026-07-30 恢复凭据持久化)
 *
 * 视觉规范(对标 web 端 PasswordLoginForm.tsx):
 *   - 容器:space-y-4 pt-2
 *   - 账号 Input h-10 + Label(启用持久化时用 AccountHistoryInput 带历史下拉)
 *   - 密码 Input h-10 + Label(右侧忘记密码链接)+ 密码显示/隐藏 toggle
 *   - 图形验证码 Input h-10 + SVG(可选,captchaEnabled=true 时显示)
 *   - 记住密码 + 自动登录 checkbox(可选,enableCredentialPersistence=true 时显示)
 *   - 协议复选框(可选)
 *   - submit Button h-10 w-full + loading
 *
 * 共享包关键差异:
 *   - 用 useState 管表单(避免引入 react-hook-form)
 *   - 图形验证码组件简单占位(调用方可通过 captcha 扩展点自定义,本组件只接受 svg+token 字符串)
 *   - 凭据持久化(2026-07-30 恢复):enableCredentialPersistence=true 时
 *     显示记住密码/自动登录 checkbox + 账号历史下拉,登录成功后持久化到 localStorage
 */
export function PasswordLoginForm({
  t,
  apiClient,
  onSuccess,
  agreed = true,
  onAgreedChange,
  onRequireAgree,
  showAgreeErr,
  captchaEnabled = false,
  inputClassName,
  buttonClassName,
  showForgotPassword = false,
  onForgotPassword,
  forgotPasswordHref,
  enableCredentialPersistence = false,
}: PasswordLoginFormProps) {
  // 启用持久化时,从 localStorage 预读记住的账号密码 + 自动登录标志
  const remembered = React.useMemo(
    () => (enableCredentialPersistence ? loadRememberedCredentials() : null),
    [enableCredentialPersistence],
  )
  const [account, setAccount] = React.useState(remembered?.account ?? '')
  const [password, setPassword] = React.useState(remembered?.password ?? '')
  const [rememberPassword, setRememberPassword] = React.useState(!!remembered)
  const [autoLogin, setAutoLogin] = React.useState(
    enableCredentialPersistence ? loadAutoLogin() && !!remembered : false,
  )
  const [showPassword, setShowPassword] = React.useState(false)
  const [captcha, setCaptcha] = React.useState('')
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
  const [captchaSvg, setCaptchaSvg] = React.useState<string | null>(null)
  const [captchaOk, setCaptchaOk] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)
  /** 自动登录提交标记:绕过 agreement 检查(agreed 默认 false 会阻止自动提交) */
  const isAutoLoginRef = React.useRef(false)

  // 加载图形验证码
  const refreshCaptcha = React.useCallback(async () => {
    if (!captchaEnabled || !apiClient.fetchCaptcha) return
    setCaptchaOk(false)
    setCaptcha('')
    try {
      const data = await apiClient.fetchCaptcha()
      if (data) {
        setCaptchaSvg(data.svg)
        setCaptchaToken(data.token)
      }
    } catch {
      /* 验证码加载失败不阻塞表单 */
    }
  }, [captchaEnabled, apiClient])

  React.useEffect(() => {
    if (captchaEnabled) void refreshCaptcha()
  }, [captchaEnabled, refreshCaptcha])

  // 自动登录:加载时 autoLogin 为 true 且已有记住的凭据,则自动提交表单
  React.useEffect(() => {
    if (!enableCredentialPersistence) return
    if (!autoLogin) return
    if (!remembered?.account || !remembered?.password) return
    // 标记自动登录提交,onsubmit 中绕过 agreement 检查
    isAutoLoginRef.current = true
    // 延迟执行让 UI 先渲染,用户看到表单闪过后自动提交
    const timer = setTimeout(() => {
      formRef.current?.requestSubmit()
    }, 300)
    return () => clearTimeout(timer)
  }, []) // 仅 mount 时执行一次

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!agreed) {
      if (isAutoLoginRef.current) {
        // 自动登录:自动同意协议,跳过 agreement 检查
        isAutoLoginRef.current = false
      } else {
        onRequireAgree?.()
        return
      }
    }
    if (!account.trim()) {
      setError(t('auth.invalidAccount'))
      return
    }
    if (!password) {
      setError(t('auth.invalidPassword'))
      return
    }
    if (captchaEnabled && !captchaOk) {
      setError(t('auth.captchaPlaceholder'))
      await refreshCaptcha()
      return
    }
    setSubmitting(true)
    try {
      const result: ApiResult<LoginResult> = await apiClient.loginByAccount(
        account,
        password,
        captchaEnabled ? captcha : undefined,
      )
      if (!result.success || !result.data?.accessToken) {
        setError(result.error || t('auth.loginFailed'))
        if (captchaEnabled) await refreshCaptcha()
        return
      }
      // 凭据持久化(2026-07-30 恢复):登录成功后保存账号历史 + 记住密码 + 自动登录
      if (enableCredentialPersistence) {
        saveLoginHistory(account)
        if (rememberPassword) {
          saveRememberedCredentials(account, password)
        } else {
          clearRememberedCredentials()
          clearAutoLogin()
        }
        saveAutoLogin(autoLogin && rememberPassword)
      }
      await onSuccess?.(result.data)
    } catch {
      setError(t('auth.loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault()
    if (onForgotPassword) {
      onForgotPassword()
    } else if (forgotPasswordHref) {
      window.location.href = forgotPasswordHref
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        // 兜底:Radix Dialog/Portal 内浏览器 implicit form submission 在某些场景失效
        // (实测:input 上按 Enter 不触发 form submit,但 form.requestSubmit() 能正常触发)。
        // 原因推测:Radix Dialog Content/FocusScope/Portal 组合干扰了浏览器原生 Enter 提交。
        // 修复:Enter 在 INPUT 上时主动 requestSubmit;AgreementCheckbox 自身 onKeyDown
        // 已处理 Enter(标签 target 不是 INPUT,不进入此分支,避免重复 requestSubmit)。
        // AccountHistoryInput 历史下拉打开 + 高亮项时,Enter 选中账号(stopPropagation 不进此分支)。
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
        <Label htmlFor="login-form-account">{t('auth.account')}</Label>
        {enableCredentialPersistence ? (
          <AccountHistoryInput
            t={t}
            id="login-form-account"
            type="text"
            autoComplete="username"
            placeholder={t('auth.accountPlaceholder')}
            inputClassName={cn('h-10', inputClassName)}
            value={account}
            onChange={setAccount}
            disabled={submitting}
            ariaLabel={t('auth.account')}
            active={!submitting}
          />
        ) : (
          <Input
            id="login-form-account"
            name="username"
            type="text"
            autoComplete="username"
            required
            aria-required
            placeholder={t('auth.accountPlaceholder')}
            className={cn('h-10', inputClassName)}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            disabled={submitting}
            data-testid="login-account-input"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-form-password">{t('auth.password')}</Label>
          {showForgotPassword && (onForgotPassword || forgotPasswordHref) && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {t('auth.forgotPassword')}
            </button>
          )}
        </div>
        <div className="relative">
          <Input
            id="login-form-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            aria-required
            placeholder={t('auth.passwordPlaceholder')}
            className={cn('h-10 pr-10', inputClassName)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            data-testid="login-password-input"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? t('a11y.hidePassword') : t('a11y.showPassword')}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {captchaEnabled && (
        <div className="space-y-1.5">
          <Label htmlFor="login-form-captcha">{t('auth.captcha')}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="login-form-captcha"
              name="captcha"
              placeholder={t('auth.captchaPlaceholder')}
              autoComplete="off"
              required
              aria-required
              className={cn('h-10 flex-1', inputClassName)}
              value={captcha}
              onChange={(e) => {
                setCaptcha(e.target.value)
                if (captchaToken && e.target.value.length >= 4) {
                  setCaptchaOk(true)
                }
              }}
              disabled={submitting}
              data-testid="login-captcha-input"
            />
            {captchaSvg ? (
              <button
                type="button"
                onClick={() => void refreshCaptcha()}
                aria-label={t('auth.captchaRefresh')}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-input bg-background px-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                tabIndex={-1}
              >
                <span
                  className="h-10 w-[100px] [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: captchaSvg }}
                />
              </button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 px-3 text-sm"
                onClick={() => void refreshCaptcha()}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      )}

      {enableCredentialPersistence && (
        <div className="flex items-center justify-between pt-1">
          <label
            className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Checkbox
              checked={rememberPassword}
              onCheckedChange={(v) => {
                const checked = v === true
                setRememberPassword(checked)
                if (!checked) setAutoLogin(false)
              }}
              aria-label={t('auth.rememberPassword')}
            />
            {t('auth.rememberPassword')}
          </label>
          <label
            className={cn(
              'flex items-center gap-2 text-xs',
              rememberPassword
                ? 'cursor-pointer text-muted-foreground'
                : 'cursor-not-allowed text-muted-foreground/50',
            )}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Checkbox
              checked={autoLogin}
              disabled={!rememberPassword}
              onCheckedChange={(v) => setAutoLogin(v === true)}
              aria-label={t('auth.autoLogin')}
            />
            {t('auth.autoLogin')}
          </label>
        </div>
      )}

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

/** 错误提示(共享 Alert 样式,不依赖 web Alert 组件) */
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
