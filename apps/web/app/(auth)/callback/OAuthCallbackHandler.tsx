// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { notifyExtensionAuth } from '@/lib/ext-auth-relay'
import { useAuthStore } from '@/stores/auth'
import { buildMainDomainUrl, isAuthSubdomainHost } from '@/lib/auth-domains'
import { resolvePostLoginLanding, type PostLoginUser } from '@/lib/post-login-landing'
import { requestWallboardChoice } from '@/components/login/WallboardChoiceDialog'

type Status = 'loading' | 'success' | 'error'

interface OAuthCallbackHandlerProps {
  provider: 'generic' | 'google' | 'apple'
}

/**
 * 判别连接器用户授权 state（2026-11-24 立）。
 *
 * 登录 state = `randomBytes(16).toString('hex')`（32 位 hex，无点）；
 * 连接器 state = `base64url(payload).base64url(sig)`，payload 含 p/o/u/t/iat/n。
 * 两者格式互斥，故可在同一个 /callback 页安全分流 —— 复用飞书后台已白名单的
 * redirect_uri，零新增配置；连接器授权不再误入登录换 JWT 流程（那会触发 consent
 * 闸且把 user_access_token 用完后丢弃）。
 *
 * 这里只做格式判别，穷尽结构要求；真鉴权在 ai-service 侧 verify_state（HMAC 签名 +
 * 平台/owner/TTL 校验），伪造 state 过不了那一关。
 */
function parseConnectorOAuthState(state: string | null): { platform: string } | null {
  if (!state) return null
  const parts = state.split('.')
  if (parts.length !== 2) return null
  if (!/^[A-Za-z0-9_-]+$/.test(parts[0] ?? '')) return null
  if (!/^[A-Za-z0-9_-]+$/.test(parts[1] ?? '')) return null
  try {
    const raw = (parts[0] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4)
    const payload: unknown = JSON.parse(atob(padded))
    if (!payload || typeof payload !== 'object') return null
    const record = payload as Record<string, unknown>
    if (typeof record.p !== 'string' || !record.p) return null
    if (typeof record.o !== 'string' || !record.o) return null
    if (typeof record.u !== 'string' || !record.u) return null
    if (typeof record.iat !== 'number' || !Number.isFinite(record.iat)) return null
    return { platform: record.p }
  } catch {
    return null
  }
}

/**
 * 构造后端回调端点路径。
 * - google / apple 有独立端点(历史遗留)
 * - generic 平台从 URL ?platform=xxx 读取,调用 /api/auth/{platform}/callback
 *   后端 /auth/:platform/callback 支持:dingtalk / enterpriseWechat / wechat / feishu / github / alipay
 */
function buildApiPath(
  provider: OAuthCallbackHandlerProps['provider'],
  platformParam: string | null,
): string | null {
  if (provider === 'google') return '/api/auth/google/callback'
  if (provider === 'apple') return '/api/auth/apple/callback'
  // generic:必须从 URL 读 platform 参数
  if (!platformParam) return null
  return `/api/auth/${platformParam}/callback`
}

function OAuthCallbackHandlerInner({ provider }: OAuthCallbackHandlerProps) {
  const router = useRouter()
  const params = useSearchParams()
  const t = useTranslations('oAuthCallbackPage')
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const [status, setStatus] = React.useState<Status>('loading')
  const [errorMsg, setErrorMsg] = React.useState<string>('')

  React.useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    const platformParam = params.get('platform')
    const redirectTarget = params.get('redirect')

    // mobile-rn OAuth 回调:不换 token,直接跳转 ihui:// deep link 回 App
    // mobile-rn 端用 expo-web-browser.openAuthSessionAsync 发起 OAuth,
    // 自己调 oauthCallback(platform, code, state) 换 JWT,web 端只做中转
    // 注意:支付宝回调参数名为 auth_code(非 code),与 App 端 parseCallbackUrl 保持一致
    if (redirectTarget === 'mobile-rn') {
      if (!platformParam) {
        setStatus('error')
        setErrorMsg(t('error.missingPlatform'))
        return
      }
      const code = params.get('code') ?? params.get('auth_code')
      if (!code) {
        setStatus('error')
        setErrorMsg(t('error.missingCode'))
        return
      }
      const deepLinkUrl = `ihui://oauth/callback?platform=${encodeURIComponent(platformParam)}&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state ?? '')}`
      // window.location.href 触发系统 intent,iOS/Android 拦截 ihui:// scheme 返回 App
      window.location.href = deepLinkUrl
      setStatus('loading')
      return
    }

    // 连接器用户授权回调:state 形状与登录 state 互斥,识别出来后只把 code/state
    // 透传给连接器回调代理(→ ai-service 校验 HMAC、换 user token、加密落库)。
    // 绝不进下面的登录分支:那会触发 oauth-consent 闸并把 token 换 JWT 后丢弃。
    const connectorState = parseConnectorOAuthState(state)
    if (connectorState && state) {
      if (!code) {
        setStatus('error')
        setErrorMsg(t('error.missingCode'))
        return
      }
      let cancelled = false
      fetchApi<{ error?: string }>(
        `/api/callback/connectors/oauth?${new URLSearchParams({ code, state }).toString()}`,
      )
        .then((res) => {
          if (cancelled) return
          if (!res.success) {
            setStatus('error')
            setErrorMsg(res.error || t('error.loginFailed'))
            return
          }
          setStatus('success')
        })
        .catch((e: Error) => {
          if (cancelled) return
          setStatus('error')
          setErrorMsg(e.message || t('error.network'))
        })
      return () => {
        cancelled = true
      }
    }

    const apiPath = buildApiPath(provider, platformParam)

    if (!apiPath) {
      setStatus('error')
      setErrorMsg(t('error.missingPlatform'))
      return
    }

    if (!code) {
      setStatus('error')
      setErrorMsg(t('error.missingCode'))
      return
    }

    let cancelled = false
    // 2026-08-29 修复:延迟导航的 setTimeout 必须登记并在 cleanup 清理。
    // 此前 StrictMode 双挂载/快速卸载时,800ms 定时器仍会触发二次导航
    // (window.location.href / router.push),且 cancelled 未覆盖定时器回调。
    const timers: ReturnType<typeof setTimeout>[] = []
    const body = JSON.stringify({ code, state })

    fetchApi<{ token: string; refreshToken?: string; expiresIn?: number; user: unknown }>(apiPath, {
      method: 'POST',
      body,
    })
      .then((res) => {
        if (cancelled) return
        if (!res.success) {
          setStatus('error')
          setErrorMsg(res.error || t('error.loginFailed'))
          return
        }
        if (!res.data) {
          setStatus('error')
          setErrorMsg(t('error.emptyData'))
          return
        }
        setToken(res.data.token, res.data.refreshToken)
        setUser(res.data.user as never)
        // DBG-66:登录成功落 store 后把 token 送回已安装扩展(判据/形状/降级见 @/lib/ext-auth-relay)。
        // 永不抛错:扩展未装 / ID 未配置 / 发送被拒都不影响本侧登录与后续跳转。
        notifyExtensionAuth({
          accessToken: res.data.token,
          refreshToken: res.data.refreshToken,
          expiresIn: res.data.expiresIn,
        })
        setStatus('success')
        // admin 账号(roleId ≥ 1)经第三方登录完成后的建议落点为生产在线监控大屏,与主站
        // LoginDialog 共用同一落点判据(@/lib/post-login-landing)。
        // 2026-10-18 改(用户要求"弹窗让我自己选择"):主域分支不再自动跳大屏,admin 弹
        // 「要不要看数据大屏」二选一(「先不用」回落 '/',与原非 admin 根路径语义一致);
        // 认证子域分支必须整页跳回主域(Cookie 在 .aizhs.top 已种好,跨域导航弹窗组件
        // 挂不住也没有意义),admin 保持原整页跳大屏语义不变。
        const resolved = resolvePostLoginLanding(res.data.user as PostLoginUser)
        if (isAuthSubdomainHost()) {
          const landing = resolved ?? '/'
          // 分域 SSO (2026-07-21):当前在认证子域,Cookie 已写在 .aizhs.top,
          // 跨域生效后跳回主域,主域 useAuthBootstrap 自动读 Cookie 恢复登录态
          timers.push(
            setTimeout(() => {
              if (cancelled) return
              window.location.href = buildMainDomainUrl(landing)
            }, 800),
          )
        } else if (resolved) {
          timers.push(
            setTimeout(() => {
              if (cancelled) return
              requestWallboardChoice(resolved, { stayFallback: '/' })
            }, 800),
          )
        } else {
          timers.push(
            setTimeout(() => {
              if (cancelled) return
              router.push('/')
            }, 800),
          )
        }
      })
      .catch((e: Error) => {
        if (cancelled) return
        setStatus('error')
        setErrorMsg(e.message || t('error.network'))
      })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [params, provider, router, setToken, setUser, t])

  if (status === 'loading') {
    return (
      <div className="space-y-4 p-3 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-body text-muted-foreground">
          {t('loading', { provider: providerLabel(provider, t) })}
        </p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="space-y-4 p-3 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="text-body font-medium">{t('success')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-3 text-center">
      <XCircle className="mx-auto h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <p className="text-body font-medium">{t('failedTitle')}</p>
        <p className="text-label text-muted-foreground">{errorMsg}</p>
      </div>
      <Link
        href="/login"
        className="inline-block rounded-md bg-cta px-4 py-2 text-body font-medium text-cta-foreground hover:bg-cta/90"
      >
        {t('backToLogin')}
      </Link>
    </div>
  )
}

/**
 * Suspense 包裹的 OAuth 回调处理器(2026-07-24 A 套壳适配)
 * output:'export' 模式要求 useSearchParams() 被 <Suspense> 边界包裹
 */
export function OAuthCallbackHandler({ provider }: OAuthCallbackHandlerProps) {
  return (
    <React.Suspense fallback={null}>
      <OAuthCallbackHandlerInner provider={provider} />
    </React.Suspense>
  )
}

function providerLabel(
  provider: OAuthCallbackHandlerProps['provider'],
  t: ReturnType<typeof useTranslations>,
): string {
  if (provider === 'google') return t('provider.google')
  if (provider === 'apple') return t('provider.apple')
  return t('provider.thirdParty')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
