'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'
import { Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { AuthShell, AuthShellPage } from '@/components/auth/AuthShell'
import { LoginFormContent } from '@/components/login/LoginFormContent'
import { RegisterFormContent } from '@/components/login/RegisterFormContent'
import { ForgotPasswordForm } from '@/components/login/ForgotPasswordForm'

/**
 * SSO 统一登录页(2026-07-22 重做:复用主站 LoginFormContent,功能完全同步)
 *
 * 设计:
 * - 路由保留(/sso/login),外部子项目跳转链接无需改
 * - 视觉:全屏遮罩 + 居中弹窗卡片(AuthShellPage + AuthShell),与主站 LoginDialog 共用 AuthShell 外壳
 * - 功能:与主站 LoginDialog 完全同步 —— 4 tab 登录(邮箱验证码/手机验证码/账号密码/扫码)
 *   + 注册 + 忘记密码 + 8 平台第三方登录 + 协议同意 + 记住密码 + 图形验证码
 * - 登录成功 → 调 /api/auth/sso/code → 跳回 redirect?sso_code=xxx
 * - 注册成功 → 切回 login mode(继续走登录授权)
 * - 忘记密码 → 重置成功切回 login mode
 *
 * 关闭策略:右上 X 按钮 → 跳转 redirect 或首页(让子项目处理"用户取消"逻辑)
 *
 * 2026-07-22 修订:从"手写账号密码表单 + 单独 ThirdPartyLoginButtons"改为复用 LoginFormContent,
 * 解决 SSO 与主站 LoginDialog 功能不同步问题(原 SSO 缺少邮箱验证码/手机验证码/扫码登录/注册/忘记密码/协议同意/记住密码/图形验证码)。
 */
export default function SsoLoginPage() {
  const tSso = useTranslations('sso')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'
  const clientId = searchParams.get('client_id') || 'web'

  const { token, user } = useAuthStore()
  const mode = useLoginDialogStore((s) => s.mode)
  const setMode = useLoginDialogStore((s) => s.setMode)
  const [exchanging, setExchanging] = React.useState(false)

  // SSO 页面 mount 时初始化 mode='login',unmount 时清理 store 避免污染主站 LoginDialog
  // (ForgotPasswordForm 重置成功后会调 store.open('login') 导致 isOpen=true,需在离开 SSO 时重置)
  React.useEffect(() => {
    useLoginDialogStore.getState().setMode('login')
    return () => {
      const s = useLoginDialogStore.getState()
      if (s.isOpen || s.mode !== 'login') {
        useLoginDialogStore.setState({ isOpen: false, mode: 'login', redirectUrl: null })
      }
    }
  }, [])

  const handleClose = React.useCallback(() => {
    router.push(redirectUrl)
  }, [router, redirectUrl])

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
        toast.error(!r.success ? r.error : tSso('generateCodeFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tSso('generateCodeFailed'))
    } finally {
      setExchanging(false)
    }
  }

  const handleLoginSuccess = React.useCallback(() => {
    void generateCodeAndRedirect()
  }, [])

  // 已登录分支:授权跳转卡片
  if (token && user) {
    return (
      <AuthShellPage>
        <AuthShell
          title={tSso('alreadyLoggedIn')}
          subtitle={tSso('authorizing', { clientId })}
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
            {tSso('authorizeAndRedirect')}
          </Button>
        </AuthShell>
      </AuthShellPage>
    )
  }

  // 未登录分支:根据 mode 切换 login/register/forgot(复用主站 LoginFormContent 等)
  const title =
    mode === 'login'
      ? tSso('title')
      : mode === 'register'
        ? tSso('registerTitle')
        : tAuth('forgotPassword')
  const subtitle = mode === 'forgot' ? tAuth('forgotSubtitle') : tSso('subtitle', { clientId })
  const footer = mode === 'login' ? tSso('footerHint') : undefined

  return (
    <AuthShellPage>
      <AuthShell title={title} subtitle={subtitle} onClose={handleClose} footer={footer}>
        {mode === 'login' ? (
          <LoginFormContent onSuccess={handleLoginSuccess} />
        ) : mode === 'register' ? (
          <RegisterFormContent onSuccess={() => setMode('login')} />
        ) : (
          <ForgotPasswordForm />
        )}
      </AuthShell>
    </AuthShellPage>
  )
}
