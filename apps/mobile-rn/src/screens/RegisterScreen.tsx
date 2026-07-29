import { useRef } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { register } from '@ihui/api-client'
import { useRegisterForm } from '@ihui/shared/hooks'
import { RegisterScreen as SharedRegisterScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * mobile-rn 注册页(2026-07-29 重构:接入 @ihui/shared/hooks useRegisterForm)
 *
 * 消除本地 useState + handleRegister 重复逻辑,改用跨端共享 hook。
 * - type: 'account'(账号注册,无验证码)
 * - registerApi:调用 @ihui/api-client register,返回 token/user 给 hook
 * - onRegisterSuccess:注册成功后调 AuthContext.login(account, password) 自动登录;
 *   失败时跳 Login 页让用户手动登录(保留原 wrapper 行为)
 * - accountRef/passwordRef:缓存表单值供 onRegisterSuccess 使用,避免闭包 stale
 */
export function RegisterScreen() {
  const { t } = useI18n()
  const { login } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const accountRef = useRef('')
  const passwordRef = useRef('')

  const form = useRegisterForm({
    type: 'account',
    enableCode: false,
    enableConfirmPassword: true,
    enableAutoLogin: true,
    registerApi: async (v) => {
      accountRef.current = v.account.trim()
      passwordRef.current = v.password
      const res = await register(v.account.trim(), v.password)
      if (res.success) {
        const user = res.data.user
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
    onRegisterSuccess: async (result) => {
      if (!result.success) return
      const r = await login(accountRef.current, passwordRef.current)
      if (!r.success) {
        navigation.navigate('Login')
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
    <SharedRegisterScreen
      t={t}
      account={form.values.account}
      password={form.values.password}
      confirmPassword={form.values.confirmPassword}
      loading={form.submitting}
      error={translateError(form.error)}
      onAccountChange={form.setAccount}
      onPasswordChange={form.setPassword}
      onConfirmPasswordChange={form.setConfirmPassword}
      onRegister={form.register}
      onBack={() => navigation.goBack()}
    />
  )
}
