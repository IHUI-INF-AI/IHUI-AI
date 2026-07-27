'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'

import { LoginForm, type LoginApiClient, type LoginResult } from '@ihui/ui-react'

import { useAuthStore, type AuthUser } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { fetchApi } from '@/lib/api'
import { useThirdPartyConfig } from '@/hooks/use-third-party-config'
import { QrCodeLogin } from './QrCodeLogin'

interface LoginFormContentProps {
  onSuccess?: () => void
}

/**
 * web 端 LoginApiClient(2026-07-26 改用共享 LoginForm)
 *
 * 基于本地 fetchApi 包装 5 个共享 LoginForm 期望的 API 端点。
 * 后端实际返回的 user 字段比共享 LoginResult.user 更丰富(包含 username/bio/permissions 等),
 * 结构上向后兼容(共享类型只取 id/phone/email/nickname/avatar 5 个字段)。
 */
const webLoginApiClient: LoginApiClient = {
  loginByAccount: async (account, password, captcha) =>
    fetchApi<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(captcha ? { account, password, captcha } : { account, password }),
    }),
  loginByEmailCode: async (email, code) =>
    fetchApi<LoginResult>('/api/auth/login/email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  loginBySms: async (phone, code) =>
    fetchApi<LoginResult>('/api/auth/login/sms', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  sendEmailCode: async (email) =>
    fetchApi<{ sent: boolean }>('/api/auth/email/code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  sendSmsCode: async (phone) =>
    fetchApi<{ sent: boolean }>('/api/auth/sms/send', {
      method: 'POST',
      body: JSON.stringify({ phone, scene: 'login' }),
    }),
}

/**
 * 共享 LoginForm 的 QR tab 注入 web 端 QrCodeLogin(SDK 二维码)
 * 简化方案:QrCodeLogin 内部管理 platform/refreshKey,共享 QrTab 的注入参数可忽略。
 */
function QrCodeLoginEmbedded() {
  return <QrCodeLogin onSwitchMethod={() => {}} />
}

export function LoginFormContent({ onSuccess }: LoginFormContentProps) {
  // 共享 @ihui/ui-react.LoginForm 内部调用 t('auth.xxx') 长 key 路径,
  // 必须用无命名空间的 useTranslations() 让 t 能解析完整路径;
  // 若用 useTranslations('auth'),t('auth.emailLogin') 会查找 auth.auth.emailLogin 失败并回退显示 key 名。
  const t = useTranslations()
  const qc = useQueryClient()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const setMode = useLoginDialogStore((s) => s.setMode)
  const thirdParty = useThirdPartyConfig()

  const handleSuccess = React.useCallback(
    async (data: LoginResult) => {
      setToken(data.accessToken, data.refreshToken)
      if (data.user) setUser(data.user as unknown as AuthUser)
      qc.invalidateQueries({ queryKey: ['header'] })
      qc.invalidateQueries({ queryKey: ['announcements'] })
      onSuccess?.()
    },
    [setToken, setUser, qc, onSuccess],
  )

  return (
    <LoginForm
      t={t}
      apiClient={webLoginApiClient}
      onSuccess={handleSuccess}
      thirdParty={thirdParty}
      showAgreement
      agreementMode="notice-dialog"
      onRegister={() => setMode('register')}
      showForgotPassword
      onForgotPassword={() => setMode('forgot')}
      qrComponent={() => <QrCodeLoginEmbedded />}
    />
  )
}
