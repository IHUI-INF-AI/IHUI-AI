/**
 * LoginPage — 扩展端登录页(2026-07-26 同步 web 端 LoginDialog 视觉)
 *
 * 视觉对齐 apps/web/src/components/auth/AuthShell.tsx + apps/web/src/components/login/PasswordLoginForm.tsx:
 *   - 外壳:ExtensionAuthShell(rounded-xl + border + bg-card + 双层阴影 + p-7)
 *   - 顶部:logo (31×31) + welcome.svg/baiwelcome.svg 浅/深主题并排
 *   - 表单:space-y-4 + Label + Input h-10 + PasswordInput(带 show/hide 切换)
 *   - 错误:Alert 风格(红色 destructive/10 背景 + 边框)
 *   - 按钮:h-10 w-full
 *
 * 扩展端简化(无验证码/无协议复选框/无 react-hook-form):
 *   - 用 useState 直接管表单(表单字段少,react-hook-form 反而增加复杂度)
 *   - 去掉验证码(扩展端无对应后端)
 *   - 去掉协议复选框(扩展端是 browser_action 唤起,隐含用户已接受)
 */
import { useState } from 'react'
import { loginByAccount, type LoginResult } from '@ihui/api-client'
import { Button, Input, Label } from '@ihui/ui-react'
import { ExtensionAuthShell } from '../../components/ExtensionAuthShell'
import { useI18n } from '../../../src/i18n'

interface Props {
  onSuccess: (result: LoginResult) => void | Promise<void>
}

/** 密码输入框:带 show/hide 切换(对齐 web PasswordInput 体验,2026-07-26 升级) */
function PasswordInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative w-full">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="h-10 pr-10"
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? '隐藏密码' : '显示密码'}
        aria-pressed={visible}
        className="absolute right-2 top-0 flex h-10 w-10 items-center justify-center overflow-visible rounded-r-md text-foreground/60 transition-colors duration-200 hover:text-foreground focus-visible:outline-none disabled:opacity-50"
      >
        {visible ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 512"
            fill="currentColor"
            fillRule="evenodd"
            aria-hidden
            className="h-5 w-5"
          >
            <path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 512"
            fill="currentColor"
            fillRule="evenodd"
            aria-hidden
            className="h-5 w-5"
          >
            <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z" />
          </svg>
        )}
      </button>
    </div>
  )
}

export default function LoginPage({ onSuccess }: Props) {
  const { t } = useI18n()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account || !password) {
      setError(t('auth.loginRequired'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await loginByAccount(account, password)
      if (res.success) {
        await onSuccess(res.data)
      } else {
        setError(res.error || t('auth.loginFailed'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <ExtensionAuthShell
        title={t('auth.login')}
        subtitle={t('auth.loginSubtitle')}
        className="max-w-[420px]"
      >
        <form onSubmit={onLogin} className="space-y-4 pt-2">
          {error ? (
            <div
              role="alert"
              className="border border-red-500/30 bg-red-500/5 text-red-500 rounded-md px-3 py-2 text-xs flex items-start gap-2"
            >
              <span className="shrink-0 leading-none">⚠</span>
              <span className="flex-1">{error}</span>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="sp-account">{t('auth.account') || t('auth.phoneOrEmail')}</Label>
            <Input
              id="sp-account"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={t('auth.phoneOrEmail')}
              disabled={loading}
              className="h-10"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-password">{t('auth.password')}</Label>
            <PasswordInput
              id="sp-password"
              value={password}
              onChange={setPassword}
              disabled={loading}
              placeholder={t('auth.password')}
            />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={loading}>
            {loading ? t('common.loading') : t('auth.login')}
          </Button>
        </form>
      </ExtensionAuthShell>
    </div>
  )
}
