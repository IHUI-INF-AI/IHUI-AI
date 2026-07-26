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
import { useMemo } from 'react'
import type { LoginResult as ApiClientLoginResult } from '@ihui/api-client'
import { AuthShell, LoginForm, type LoginResult } from '@ihui/ui-react'

import { createExtensionLoginApiClient } from '../../../lib/login-api-client'
import { useI18n } from '../../../src/i18n'
import { useSystemTheme } from '../../../src/hooks/use-system-theme'
import { useExtensionThirdPartyAuth } from '../../../src/hooks/use-extension-third-party-auth'

interface Props {
  onSuccess: (result: ApiClientLoginResult) => void | Promise<void>
}

/** 跳 web 端登录/注册/忘记密码(注册/忘记密码回调用) */
function openWeb(): void {
  const url = 'https://www.ihui.ai/signin'
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

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <AuthShell
        title={t('auth.login')}
        subtitle={t('auth.loginSubtitle')}
        closeAriaLabel={t('common.close') || 'Close'}
        className="max-w-[420px]"
      >
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
