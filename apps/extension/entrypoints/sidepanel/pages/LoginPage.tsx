/**
 * LoginPage - 扩展端登录页(2026-07-26 改造:用完整共享 LoginForm + AuthShell + 系统主题跟随)
 *
 * 视觉对齐 apps/web/src/components/auth/AuthShell.tsx + apps/web/src/components/login/LoginFormContent.tsx:
 *   - 外壳:共享 @ihui/ui-react.AuthShell(rounded-xl + border + bg-card + 双层阴影 + p-7)
 *   - 顶部:logo (31x31) + welcome.svg/baiwelcome.svg 浅/深主题并排
 *   - 表单:共享 LoginForm(4 tab + 8 三方 + 协议弹窗 + 注册/忘记密码 + OTP)
 *   - 跟 web 端 LoginDialog 100% 一致(2026-07-26 立)
 *
 * 2026-07-26 改造要点:
 *   - 完整共享 LoginForm:4 tab(email/phone/password/qr)+ 8 三方 + 协议 + 注册/忘记密码链接
 *   - 三方登录:useExtensionThirdPartyAuth,点击 → 打开 web 端 OAuth
 *   - 协议:showAgreement + agreementMode="notice-dialog"(跟 web 端一致)
 *   - 注册/忘记密码 → 打开 web 端
 *   - 去掉本地手写 PasswordInput + 手写表单(全部用共享版)
 *   - useSystemTheme 跟随 OS 主题
 */
import { AuthShell, LoginForm } from '@ihui/ui-react'
import type { LoginResult } from '@ihui/api-client'
import { useI18n } from '../../../src/i18n'
import { useSystemTheme } from '../../../src/hooks/use-system-theme'
import { useExtensionThirdPartyAuth } from '../../../src/hooks/use-extension-third-party-auth'
import { loginApiClient } from '../../../lib/login-api'

interface Props {
  onSuccess: (result: LoginResult) => void | Promise<void>
}

const openWeb = () => {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url: 'https://www.ihui.ai/' })
  } else {
    window.open('https://www.ihui.ai/', '_blank', 'noopener,noreferrer')
  }
}

export default function LoginPage({ onSuccess }: Props) {
  const { t } = useI18n()
  useSystemTheme()
  const thirdParty = useExtensionThirdPartyAuth()

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
          onRegister={openWeb}
          onForgotPassword={openWeb}
          onSuccess={async (data) => {
            // 包装回 web 端 LoginResult 形参(onSuccess 来自 SidepanelApp)
            await onSuccess({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              expiresIn: data.expiresIn,
              refreshExpiresIn: data.expiresIn,
              user: {
                id: data.user?.id ?? '',
                nickname: data.user?.nickname,
                avatar: data.user?.avatar,
                phone: data.user?.phone,
                email: data.user?.email,
              },
            })
          }}
        />
      </AuthShell>
    </div>
  )
}
