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
import type { ThirdPartyPlatform, ApiResult } from '@ihui/types'
import { useThirdPartyConfig } from '@/hooks/use-third-party-config'
import { verifyTwoFactorLogin } from '@ihui/api-client'
import { QrCodeLogin } from './QrCodeLogin'
import { useTurnstile } from './LoginWithTurnstile'

interface LoginFormContentProps {
  onSuccess?: () => void
}

/** 登录响应可能携带 2FA 挑战(后端 twoFactorRequired + challengeToken) */
type LoginResponseWith2fa = LoginResult & {
  twoFactorRequired?: boolean
  challengeToken?: string
}

/**
 * 2FA 验证面板(2026-08-06 立):登录响应 twoFactorRequired 时展示,
 * 收集 TOTP(6 位)或备用码(AAAA-AAAA),Promise 方式把 code 交回登录流程。
 */
function TwoFactorPanel({
  onSubmit,
  onCancel,
}: {
  onSubmit: (code: string) => void
  onCancel: () => void
}) {
  const tAuth = useTranslations('auth')
  const [code, setCode] = React.useState('')
  const [err, setErr] = React.useState('')
  const handleSubmit = () => {
    const v = code.trim()
    if (v.length < 6) {
      setErr(tAuth('twoFactorError'))
      return
    }
    onSubmit(v)
  }
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{tAuth('twoFactorTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{tAuth('twoFactorHint')}</p>
      </div>
      <input
        value={code}
        onChange={(e) => {
          setCode(e.target.value)
          setErr('')
        }}
        placeholder={tAuth('twoFactorPlaceholder')}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- 两步验证码输入框需要自动聚焦，提升用户体验
        autoFocus
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!code.trim()}
          className="h-9 flex-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {tAuth('twoFactorSubmit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-md border border-border px-4 text-sm text-muted-foreground hover:bg-muted/50"
        >
          {tAuth('twoFactorCancel')}
        </button>
      </div>
    </div>
  )
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
function useWebLoginApiClient(
  request2faCode: (challengeToken: string) => Promise<string>,
): LoginApiClient {
  const { token: turnstileToken } = useTurnstile()
  const turnstileTokenRef = React.useRef(turnstileToken)
  turnstileTokenRef.current = turnstileToken

  return React.useMemo<LoginApiClient>(() => {
    const buildLoginBody = (base: Record<string, string>): string => {
      const tk = turnstileTokenRef.current
      if (tk) base.turnstileToken = tk
      return JSON.stringify(base)
    }

    /**
     * 2026-08-06 立:2FA 挑战拦截 —— 登录响应 twoFactorRequired=true 时,
     * 弹 2FA 面板收集 TOTP/备用码 → verifyTwoFactorLogin → 返回完整登录结果。
     * 对共享 LoginForm 完全透明(它只看到最终成功/失败)。
     */
    const with2fa = async (
      p: Promise<ApiResult<LoginResponseWith2fa>>,
    ): Promise<ApiResult<LoginResult>> => {
      const res = await p
      if (res.success && res.data?.twoFactorRequired && res.data.challengeToken) {
        const code = await request2faCode(res.data.challengeToken)
        if (!code) return { success: false, error: '2FA 验证已取消' }
        return verifyTwoFactorLogin(res.data.challengeToken, code)
      }
      return res
    }

    return {
      loginByAccount: async (account, password, captcha) => {
        const body: Record<string, string> = { account, password }
        if (captcha) body.captcha = captcha
        return with2fa(
          fetchApi<LoginResponseWith2fa>('/api/auth/login', {
            method: 'POST',
            body: buildLoginBody(body),
          }),
        )
      },
      loginByEmailCode: async (email, code) =>
        with2fa(
          fetchApi<LoginResponseWith2fa>('/api/auth/login/email', {
            method: 'POST',
            body: buildLoginBody({ email, code }),
          }),
        ),
      loginBySms: async (phone, code) =>
        with2fa(
          fetchApi<LoginResponseWith2fa>('/api/auth/login/sms', {
            method: 'POST',
            body: buildLoginBody({ phone, code }),
          }),
        ),
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
  }, [request2faCode])
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
        src="/images/oauth-providers/feishu.svg"
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
  // 若用 useTranslations('auth'),键路径会变成 auth.auth.emailLogin 失败并回退显示 key 名。
  const t = useTranslations()
  const qc = useQueryClient()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const setMode = useLoginDialogStore((s) => s.setMode)
  const thirdParty = useThirdPartyConfig()

  // 2026-08-06 立:2FA 登录流程 —— pending2fa 非空时显示验证面板,
  // request2faCode 返回 Promise,面板提交 code 后 resolve(对登录流程透明)。
  const [pending2fa, setPending2fa] = React.useState(false)
  const pending2faResolve = React.useRef<((code: string) => void) | null>(null)
  const request2faCode = React.useCallback((_challengeToken: string) => {
    return new Promise<string>((resolve) => {
      pending2faResolve.current = resolve
      setPending2fa(true)
    })
  }, [])
  const submit2fa = React.useCallback((code: string) => {
    setPending2fa(false)
    pending2faResolve.current?.(code)
    pending2faResolve.current = null
  }, [])
  const cancel2fa = React.useCallback(() => {
    setPending2fa(false)
    pending2faResolve.current?.('')
    pending2faResolve.current = null
  }, [])

  const apiClient = useWebLoginApiClient(request2faCode)

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
    <div className="relative">
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
      {pending2fa && (
        // 2FA 验证面板覆盖层:登录响应 twoFactorRequired 时弹出
        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/95 pt-10 backdrop-blur-sm">
          <div className="w-[320px] rounded-lg border border-border p-5 shadow-lg">
            <TwoFactorPanel onSubmit={submit2fa} onCancel={cancel2fa} />
          </div>
        </div>
      )}
    </div>
  )
}
