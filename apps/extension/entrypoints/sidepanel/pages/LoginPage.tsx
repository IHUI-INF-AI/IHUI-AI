/**
 * LoginPage - 扩展端登录页(2026-07-26 改造:接入共享 @ihui/ui-react.LoginForm)
 *
 * 视觉对齐 apps/web/src/components/login/LoginDialog.tsx + LoginFormContent.tsx:
 *   - 外壳:共享 @ihui/ui-react.AuthShell(rounded-xl + border + bg-card + 双层阴影 + p-7)
 *   - 顶部:logo (31x31) + welcome.svg/baiwelcome.svg 浅/深主题并排
 *   - 表单:共享 LoginForm(4 tab + 8 第三方登录 + 协议复选框 + 注册/忘记密码链接)
 *   - 错误:每个 tab 独立,切换时清空
 *   - 协议:agreementMode=notice-dialog → 弹窗提示
 *
 * 2026-07-26 共享 LoginForm 接入:
 *   - 删除手写 form / PasswordInput / onLogin,统一用共享 LoginForm
 *   - apiClient 由 createExtensionLoginApiClient 适配 chrome.storage + token 刷新
 *   - thirdParty 由 useExtensionThirdPartyAuth 注入 8 平台(跳 web OAuth)
 *   - onSuccess 转发:把共享 LoginResult 转成 api-client LoginResult 喂给 SidepanelApp
 *
 * 主题跟随:
 *   - useSystemTheme hook 监听 OS prefers-color-scheme,自动给 html 加 .dark class
 *   - 让 sidepanel 跟 web 端 + popup 用同一份 .login-scope / .welcome-img 共享 CSS,
 *     浅/深主题切换视觉一致
 */
import { useMemo, useState } from 'react'
import type { LoginResult as ApiClientLoginResult } from '@ihui/api-client'
import { AuthShell, LoginForm, type LoginResult } from '@ihui/ui-react'

import { createExtensionLoginApiClient } from '../../../lib/login-api-client'
import { useI18n } from '../../../src/i18n'
import { useSystemTheme } from '../../../src/hooks/use-system-theme'
import { useExtensionThirdPartyAuth } from '../../../src/hooks/use-extension-third-party-auth'
// 2026-08-01 立:Extension SSO 一键授权登录(chrome.identity.launchWebAuthFlow),
// 用户已在 web 端登录时无需再输账号密码,直接拉起 web SSO 授权页拿 token
import { loginWithSso } from '../../../src/lib/sso'

interface Props {
  onSuccess: (result: ApiClientLoginResult) => void | Promise<void>
}

/** 跳 web 端登录/注册/忘记密码(注册/忘记密码回调用) */
function openWeb(): void {
  const url = 'https://www.aizhs.top/signin'
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url })
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export default function LoginPage({ onSuccess }: Props) {
  const { t } = useI18n()
  // 2026-07-26 改造:sidepanel 启用系统主题跟随,跟 web 端 + popup 用同一份 .login-scope
  // 共享 CSS,深色模式视觉一致。
  useSystemTheme()
  const loginApiClient = useMemo(() => createExtensionLoginApiClient(), [])
  const thirdParty = useExtensionThirdPartyAuth()
  // SSO 一键登录状态:loading / error 提示
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoError, setSsoError] = useState<string | null>(null)

  const handleSuccess = async (data: LoginResult) => {
    // 把共享 LoginResult 转成 api-client LoginResult 喂给 SidepanelApp.onLoginSuccess
    await onSuccess({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      refreshExpiresIn: data.refreshExpiresIn ?? data.expiresIn,
      user: {
        id: data.user.id,
        phone: data.user.phone,
        email: data.user.email,
        nickname: data.user.nickname,
        avatar: data.user.avatar,
      },
    })
  }

  // 2026-08-01 立:SSO 一键授权登录处理。
  // loginWithSso 内部已 setTokenPair + scheduleRefreshAlarm + startAutoRefresh,
  // 成功后只需把 SsoTokenData 转成 ApiClientLoginResult 喂给 onSuccess 即可。
  const handleSsoLogin = async () => {
    setSsoLoading(true)
    setSsoError(null)
    try {
      const tokenData = await loginWithSso()
      if (!tokenData) {
        setSsoError(t('auth.ssoCancelled') || 'SSO 登录已取消')
        return
      }
      await onSuccess({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresIn: tokenData.expiresIn,
        refreshExpiresIn: tokenData.refreshExpiresIn,
        user: {
          id: tokenData.user.id,
          phone: tokenData.user.phone,
          email: tokenData.user.email,
          nickname: tokenData.user.nickname,
          avatar: tokenData.user.avatar,
        },
      })
    } catch (err) {
      setSsoError(err instanceof Error ? err.message : 'SSO 登录失败')
    } finally {
      setSsoLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <AuthShell
        title={t('auth.login')}
        subtitle={t('auth.loginSubtitle')}
        closeAriaLabel={t('common.close') || 'Close'}
        className="max-w-[420px]"
      >
        {/* 2026-08-01 立:SSO 一键授权登录入口。
            放在 LoginForm 上方,用户已在 web 端登录时无需再输账号密码,
            点击后 chrome.identity.launchWebAuthFlow 弹出 web SSO 授权页 */}
        <button
          type="button"
          onClick={handleSsoLogin}
          disabled={ssoLoading}
          className="login-form-scope w-full flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        >
          {ssoLoading ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
              <span>{t('auth.ssoLoading') || 'SSO 授权中...'}</span>
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>{t('auth.ssoLogin') || 'SSO 一键登录'}</span>
            </>
          )}
        </button>
        {ssoError && (
          <p className="login-form-scope text-xs text-destructive mb-2 text-center" role="alert">
            {ssoError}
          </p>
        )}
        <p className="login-form-scope text-xs text-muted-foreground text-center mb-3 mt-1">
          {t('auth.orUseAccount') || '或使用账号登录'}
        </p>
        <LoginForm
          t={t}
          apiClient={loginApiClient}
          thirdParty={thirdParty.config}
          showAgreement
          agreementMode="notice-dialog"
          showRegisterLink
          showForgotPassword
          onRegister={openWeb}
          onForgotPassword={openWeb}
          onSuccess={handleSuccess}
        />
      </AuthShell>
    </div>
  )
}
