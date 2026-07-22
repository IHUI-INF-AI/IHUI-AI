'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Button, Input, Label } from '@ihui/ui'
import { Loader2, ShieldCheck, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { AuthShell, AuthShellPage } from '@/components/auth/AuthShell'
import { ThirdPartyLoginButtons, PasswordInput } from '@/components/login'

/**
 * SSO 统一登录页(2026-07-20 重做:整页弹窗化,与主站 LoginDialog 视觉统一)
 *
 * 设计:
 * - 路由保留(/sso/login),外部子项目跳转链接无需改
 * - 视觉改为"全屏遮罩 + 居中弹窗卡片"(AuthShellPage + AuthShell)
 * - 与主站 LoginDialog 共用 AuthShell 外壳,视觉完全统一
 * - 登录流程不变:账号密码登录 → 调 /api/auth/sso/code → 跳回 redirect?sso_code=xxx
 * - 第三方登录复用 ThirdPartyLoginButtons 组件(8 平台:Google/Apple/钉钉/企业微信/微信/GitHub/飞书/支付宝)
 *   2026-07-21:从写死的钉钉+企业微信 2 平台改为复用主站 8 平台组件,统一登录入口
 *
 * 关闭策略:右上 X 按钮 → 跳转 redirect 或首页
 */
export default function SsoLoginPage() {
  const t = useTranslations('sso')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'
  const clientId = searchParams.get('client_id') || 'web'

  const { token, user } = useAuthStore()
  const [account, setAccount] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [exchanging, setExchanging] = React.useState(false)

  const handleClose = React.useCallback(() => {
    router.push(redirectUrl)
  }, [router, redirectUrl])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!account.trim() || !password) {
      toast.error(t('enterAccountAndPassword'))
      return
    }
    setLoading(true)
    try {
      const r = await fetchApi<{
        accessToken: string
        refreshToken?: string
        user: {
          id: string
          nickname: string
          avatar?: string
          roleId?: number
          permissions?: string[]
        }
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account, password }),
      })
      if (r.success && r.data) {
        useAuthStore.getState().setToken(r.data.accessToken, r.data.refreshToken ?? null)
        useAuthStore.getState().setUser({
          ...r.data.user,
          permissions: r.data.user.permissions ?? [],
        })
        toast.success(t('loginSuccess'))
        await generateCodeAndRedirect()
      } else {
        toast.error(!r.success ? r.error : t('loginFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function generateCodeAndRedirect() {
    const currentToken = useAuthStore.getState().token
    if (!currentToken) return
    setExchanging(true)
    try {
      const r = await fetchApi<{ code: string; redirectUri: string }>('/api/auth/sso/code', {
        method: 'POST',
        body: JSON.stringify({ clientId, redirectUri: redirectUrl }),
      })
      if (r.success && r.data?.code) {
        const separator = redirectUrl.includes('?') ? '&' : '?'
        router.push(`${redirectUrl}${separator}sso_code=${r.data.code}`)
      } else {
        toast.error(!r.success ? r.error : t('generateCodeFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('generateCodeFailed'))
    } finally {
      setExchanging(false)
    }
  }

  // 已登录分支:授权跳转卡片
  if (token && user) {
    return (
      <AuthShellPage>
        <AuthShell
          title={t('alreadyLoggedIn')}
          subtitle={t('authorizing', { clientId })}
          onClose={handleClose}
        >
          <Button
            className="h-10 w-full"
            onClick={() => generateCodeAndRedirect()}
            disabled={exchanging}
          >
            {exchanging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {t('authorizeAndRedirect')}
          </Button>
        </AuthShell>
      </AuthShellPage>
    )
  }

  return (
    <AuthShellPage>
      <AuthShell
        title={t('title')}
        subtitle={t('subtitle', { clientId })}
        onClose={handleClose}
        footer={t('footerHint')}
      >
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('account')}</Label>
            <Input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={t('accountPlaceholder')}
              autoComplete="username"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('password')}</Label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              autoComplete="current-password"
              className="h-10"
            />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={loading || exchanging}>
            {loading || exchanging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {t('loginBtn')}
          </Button>
        </form>

        {/* 第三方登录(复用主站 ThirdPartyLoginButtons 组件,8 平台统一) */}
        <ThirdPartyLoginButtons />
      </AuthShell>
    </AuthShellPage>
  )
}
