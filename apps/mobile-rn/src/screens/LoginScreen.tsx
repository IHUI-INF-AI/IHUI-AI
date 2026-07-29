import { useRef } from 'react'
import { loginByAccount, type AuthUser } from '@ihui/api-client'
import { useLoginForm, type LoginApiResult } from '@ihui/shared/hooks'
import { LoginScreen as SharedLoginScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { credentialStorage } from '../lib/credential-storage'
import { exchangeSsoCode, extractSsoCode, openSsoLogin } from '../lib/sso'
import { rnAuthStore } from '../stores/auth-store'

/**
 * mobile-rn 登录页(2026-07-29 重构:接入 @ihui/shared/hooks useLoginForm)
 *
 * 消除本地 useState + handleLogin + handleSsoLogin 重复逻辑,改用跨端共享 hook。
 * - loginApi:直接调用 @ihui/api-client loginByAccount(不经过 AuthContext.login,
 *   因 AuthContext.login 返回 {success, error?} 无 token/user,不满足 hook 契约)
 * - ssoLogin:复用 ../lib/sso 的 openSsoLogin + exchangeSsoCode
 * - onLoginSuccess:写 rnAuthStore.setAuth(token + refreshToken + 完整 AuthUser)
 *
 * fullUserRef:hook 的 LoginUser 类型截断了 AuthUser 的额外字段(phone/email/roleId 等),
 * 用 ref 捕获 loginApi/ssoLogin 返回的完整 AuthUser,在 onLoginSuccess 中写入 store,
 * 避免用户信息丢失(HomeScreen/ProfileScreen 等依赖完整 user)。
 */
export function LoginScreen() {
  const { t } = useI18n()
  const fullUserRef = useRef<AuthUser | null>(null)

  const form = useLoginForm({
    loginApi: async (account, password): Promise<LoginApiResult> => {
      const res = await loginByAccount(account, password)
      if (res.success) {
        const user = res.data.user
        fullUserRef.current = user
        return {
          success: true,
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          user: {
            id: user.id,
            nickname: user.nickname ?? user.username ?? '',
            avatar: user.avatar,
          },
        }
      }
      return { success: false, error: res.error }
    },
    storage: credentialStorage,
    onLoginSuccess: async (accessToken, refreshToken) => {
      const user = fullUserRef.current
      if (user) {
        await rnAuthStore.getState().setAuth({ token: accessToken, refreshToken, user })
      }
      fullUserRef.current = null
    },
    ssoLogin: async (): Promise<LoginApiResult> => {
      const redirectUrl = await openSsoLogin()
      if (!redirectUrl) return { success: false, error: '用户取消授权' }
      const code = extractSsoCode(redirectUrl)
      if (!code) return { success: false, error: 'SSO 回跳未包含 code' }
      const data = await exchangeSsoCode(code)
      if (!data) return { success: false, error: 'SSO 换取 token 失败' }
      fullUserRef.current = data.user
      return {
        success: true,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: {
          id: data.user.id,
          nickname: data.user.nickname,
          avatar: data.user.avatar,
        },
      }
    },
  })

  // hook 的 error 为 i18n key(auth.*)时走 t() 翻译,后端错误消息原样透传
  const translateError = (err: string | null): string => {
    if (!err) return ''
    if (err.startsWith('auth.')) return t(err)
    return err
  }

  return (
    <SharedLoginScreen
      t={t}
      account={form.account}
      password={form.password}
      loading={form.loading}
      ssoLoading={form.ssoLoading}
      error={translateError(form.error)}
      onAccountChange={form.setAccount}
      onPasswordChange={form.setPassword}
      onLogin={form.login}
      onSsoLogin={form.ssoLoginAction}
    />
  )
}
