'use client'

import * as React from 'react'
import Image from 'next/image'
import { Smartphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'

import {
  LoginForm,
  type LoginApiClient,
  type LoginResult,
  type QrPlatformConfig,
} from '@ihui/ui-react'

import { useAuthStore, type AuthUser } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { fetchApi } from '@/lib/api'
import type { ThirdPartyPlatform } from '@ihui/types'
import { useThirdPartyConfig } from '@/hooks/use-third-party-config'
import { QrCodeLogin } from './QrCodeLogin'
import { useTurnstile } from './LoginWithTurnstile'

interface LoginFormContentProps {
  onSuccess?: () => void
}

/**
 * 构造 web 端 LoginApiClient(2026-07-26 改用共享 LoginForm / 2026-07-31 接入 Turnstile)
 *
 * 基于本地 fetchApi 包装 5 个共享 LoginForm 期望的 API 端点。
 * 后端实际返回的 user 字段比共享 LoginResult.user 更丰富(包含 username/bio/permissions 等),
 * 结构上向后兼容(共享类型只取 id/phone/email/nickname/avatar 5 个字段)。
 *
 * Turnstile 集成(2026-07-31):三个登录端点(account/email/sms)请求体增加可选 `turnstileToken`。
 * - token 通过 useTurnstile() hook 从 LoginWithTurnstile wrapper 提供的 Context 获取
 * - 用 ref 捕获最新 token,避免 token 变化导致 apiClient 重建(保持 LoginForm 内部状态稳定)
 * - 未配置 NEXT_PUBLIC_TURNSTILE_SITE_KEY 时 token 为 null,body 不含 turnstileToken(降级放行)
 */
function useWebLoginApiClient(): LoginApiClient {
  const { token: turnstileToken } = useTurnstile()
  const turnstileTokenRef = React.useRef(turnstileToken)
  turnstileTokenRef.current = turnstileToken

  return React.useMemo<LoginApiClient>(() => {
    const buildLoginBody = (base: Record<string, string>): string => {
      const tk = turnstileTokenRef.current
      if (tk) base.turnstileToken = tk
      return JSON.stringify(base)
    }
    return {
      loginByAccount: async (account, password, captcha) => {
        const body: Record<string, string> = { account, password }
        if (captcha) body.captcha = captcha
        return fetchApi<LoginResult>('/api/auth/login', {
          method: 'POST',
          body: buildLoginBody(body),
        })
      },
      loginByEmailCode: async (email, code) =>
        fetchApi<LoginResult>('/api/auth/login/email', {
          method: 'POST',
          body: buildLoginBody({ email, code }),
        }),
      loginBySms: async (phone, code) =>
        fetchApi<LoginResult>('/api/auth/login/sms', {
          method: 'POST',
          body: buildLoginBody({ phone, code }),
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
  }, [])
}

/**
 * 扫码登录平台配置(注入共享 LoginForm 的 qrPlatforms)。
 *
 * 共享 `QrTab` 负责渲染平台切换 Tab + 提示文字 + 操作行(刷新 / 切换方式),
 * web 端只注入 SVG 图标 + labelKey,避免共享包默认 emoji 图标(💬 🏢 📌 ✈️)
 * 与第三方登录按钮区的 SVG 风格不一致。
 */
export const QR_PLATFORMS: QrPlatformConfig[] = [
  {
    // 本站 App 扫码登录(非第三方 OAuth,走 /api/auth/qr/* 端点)
    key: 'app',
    labelKey: 'auth.appLogin',
    icon: <Smartphone className="h-[14px] w-[14px] shrink-0" />,
    webUrl: '/login?method=qr&platform=app',
  },
  {
    key: 'wechat',
    labelKey: 'auth.wechatLogin',
    icon: (
      <Image
        src="/images/oauth-providers/wechat.svg"
        alt=""
        width={14}
        height={14}
        className="h-[14px] w-[14px] shrink-0"
      />
    ),
    webUrl: '/login?method=qr&platform=wechat',
  },
  {
    key: 'enterpriseWechat',
    labelKey: 'auth.enterpriseWechat',
    icon: (
      <Image
        src="/images/oauth-providers/wecom.svg"
        alt=""
        width={14}
        height={14}
        className="h-[14px] w-[14px] shrink-0"
      />
    ),
    webUrl: '/login?method=qr&platform=enterpriseWechat',
  },
  {
    key: 'dingtalk',
    labelKey: 'auth.dingtalkLogin',
    icon: (
      <Image
        src="/images/oauth-providers/dingtalk.svg"
        alt=""
        width={14}
        height={14}
        className="h-[14px] w-[14px] shrink-0"
      />
    ),
    webUrl: '/login?method=qr&platform=dingtalk',
  },
  {
    key: 'feishu',
    labelKey: 'auth.feishuLogin',
    icon: (
      <Image
        src="/images/loginSANFANG/feishu.png"
        alt=""
        width={14}
        height={14}
        className="h-[14px] w-[14px] shrink-0"
      />
    ),
    webUrl: '/login?method=qr&platform=feishu',
  },
]

/**
 * 共享 LoginForm 的 QR tab 注入 web 端 QrCodeLogin(SDK 二维码)。
 * 接收共享 QrTab 注入的 { platform, refreshKey },只渲染当前平台的二维码面板。
 */
function QrCodeLoginEmbedded({
  platform,
  refreshKey,
}: {
  platform: ThirdPartyPlatform
  refreshKey: number
}) {
  return <QrCodeLogin platform={platform} refreshKey={refreshKey} />
}

export function LoginFormContent({ onSuccess }: LoginFormContentProps) {
  // 共享 @ihui/ui-react.LoginForm 内部调用完整路径的 auth 键,
  // 必须用无命名空间的 useTranslations() 让 t 能解析完整路径;
  // 若用 useTranslations('auth'),t('auth.emailLogin') 会查找 auth.auth.emailLogin 失败并回退显示 key 名。
  const t = useTranslations()
  const qc = useQueryClient()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const setMode = useLoginDialogStore((s) => s.setMode)
  const thirdParty = useThirdPartyConfig()
  const apiClient = useWebLoginApiClient()

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
      apiClient={apiClient}
      onSuccess={handleSuccess}
      thirdParty={thirdParty}
      showAgreement
      agreementMode="notice-dialog"
      onRegister={() => setMode('register')}
      showForgotPassword
      onForgotPassword={() => setMode('forgot')}
      qrComponent={({ platform, refreshKey }) => (
        <QrCodeLoginEmbedded platform={platform} refreshKey={refreshKey} />
      )}
      qrPlatforms={QR_PLATFORMS}
      // 2026-07-30 立:启用凭据持久化(记住密码 + 自动登录 + 账号历史下拉)
      enableCredentialPersistence
    />
  )
}
