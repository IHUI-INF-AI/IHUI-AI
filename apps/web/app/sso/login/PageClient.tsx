// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'
import { fetchApi } from '@/lib/api'
import { buildSsoRedirectUrl } from '@ihui/shared'
import { ensureSsoRedirectAllowed } from '@/lib/sso-redirect-guard'
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
 *
 * 2026-09-22 修复桌面端"授权并跳转 / 右上 X 都点了没反应":
 * 现象:桌面端薄壳(窗口直接加载 https://aizhs.top/agents)已登录状态下,点
 * 「授权并跳转」或右上 X 都原地回到本页;WebView2 历史记录里
 * /sso/login?redirect=/edu/... 的 redirect 参数中 sso_code 递归膨胀到 4 层。
 * 根因:cookie 里的 auth_token 是 access JWT(15 分钟过期),而 cookie 自身 30 天;
 * 桌面端登录态靠持久化 token + Bearer 维持,API 全通,但 cookie 内 JWT 早已过期
 * → 登录守卫(proxy.ts verifyAccessTokenEdge / 生产 nginx $cookie_auth_token)对
 * redirect 目标(/admin/*、/edu/edu-management/*)一律 307 打回本页。
 * 两个按钮的导航目标都是 redirect,于是都退化为「点击后回到本页」的 307 重定向闭环。
 * 修复:跳转前用 ensureRedirectAllowed() 探测守卫是否放行,被拦则静默续期一次
 * (后端 /api/auth/refresh 会 setAuthCookies 续种 cookie)后复测;仍被拦时给出
 * 明确结果(授权按钮报会话失效,关闭按钮回首页),彻底消除静默死循环。
 */
export default function SsoLoginPage() {
  const tSso = useTranslations('sso')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'
  const clientId = searchParams.get('client_id') || 'web'

  const { token, user } = useAuthStore()
  // 取全局 auth bootstrap 的 ready(根 layout 的 GlobalHooksProvider 已触发副作用,此处仅读状态;
  // 竞态根因与渲染门详见下方 `if (!ready)` 注释)
  const { ready } = useAuthBootstrap()
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
    void (async () => {
      // 2026-09-22 修复"关闭按钮点了没反应":redirect 若是受保护的同源路径
      // (如 /edu/edu-management/*),直接跳回去必被守卫 307 弹回本页 → 看起来像按钮失灵。
      // 先确保能被放行;仍不行则回首页,避免陷入 307 重定向闭环。
      const allowed = await ensureSsoRedirectAllowed(redirectUrl)
      router.push(allowed ? redirectUrl : '/')
    })()
  }, [redirectUrl, router])

  const generateCodeAndRedirect = React.useCallback(async () => {
    const currentToken = useAuthStore.getState().token
    if (!currentToken) return
    setExchanging(true)
    try {
      // 2026-09-22:先确认回跳目标能被守卫放行(必要时静默续种 cookie)——
      // 否则生成的 sso_code 还没被消费就被 307 打回本页,用户感知即"按钮没反应"。
      if (!(await ensureSsoRedirectAllowed(redirectUrl))) {
        toast.error(tSso('sessionExpired'))
        return
      }
      const r = await fetchApi<{ code: string; redirectUri: string }>('/api/auth/sso/code', {
        method: 'POST',
        body: JSON.stringify({ clientId, redirectUri: redirectUrl }),
      })
      if (r.success && r.data?.code) {
        // 幂等构造:先剥离 redirect 里可能残留的 sso_code 再附加(2026-09-22 去重),
        // 防守卫打回重入导致 ?sso_code=A&sso_code=B 递归膨胀。
        const finalUrl = buildSsoRedirectUrl(redirectUrl, r.data.code)
        // Custom scheme(如 ihui://)需用 window.location.href 触发 OS deep-link handler,
        // router.push 无法处理非 http/https 协议(2026-08-01 desktop SSO 闭环修复)
        const isCustomScheme =
          !redirectUrl.startsWith('http://') &&
          !redirectUrl.startsWith('https://') &&
          !redirectUrl.startsWith('/')
        if (isCustomScheme) {
          window.location.href = finalUrl
        } else {
          router.push(finalUrl)
        }
      } else {
        toast.error(!r.success ? r.error : tSso('generateCodeFailed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tSso('generateCodeFailed'))
    } finally {
      setExchanging(false)
    }
  }, [clientId, redirectUrl, router, tSso])

  const handleLoginSuccess = React.useCallback(() => {
    void generateCodeAndRedirect()
  }, [generateCodeAndRedirect])

  // OIDC 回跳自动闭环(2026-09-19):企业 SSO 认证完成后后端 302 回本页并带 sso=oidc 标记,
  // bootstrap 经共享域 httpOnly cookie 恢复登录态后自动跳转 redirect(默认首页),
  // 避免用户刚完成 SSO 登录却停在授权卡片/登录表单需再手动操作。
  const fromOidc = searchParams.get('sso') === 'oidc'
  React.useEffect(() => {
    if (fromOidc && token && user) {
      router.push(redirectUrl)
    }
  }, [fromOidc, token, user, redirectUrl, router])

  // 已登录分支:授权跳转卡片
  if (token && user) {
    return (
      <AuthShellPage onClose={handleClose}>
        <AuthShell
          title={tSso('alreadyLoggedIn')}
          subtitle={tSso('authorizing', { clientId })}
          onClose={handleClose}
        >
          <Button
            size="lg"
            className="w-full px-4"
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

  // 2026-09-02 修复"登录弹窗按钮点不了":已登录用户访问本页时,useAuthBootstrap
  // 异步恢复 token 前会先渲染未登录表单,恢复完成后表单被"已登录"卡片中途替换
  // (点击竞态:点 tab 实际命中替换后的授权按钮 → 意外跳转,感知为按钮全部失灵)。
  // bootstrap 就绪前渲染 loading 骨架,杜绝表单闪现与点击错位。
  if (!ready) {
    return (
      <AuthShellPage onClose={handleClose}>
        <AuthShell
          title={tSso('title')}
          subtitle={tSso('subtitle', { clientId })}
          onClose={handleClose}
        >
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
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
    <AuthShellPage onClose={handleClose}>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
