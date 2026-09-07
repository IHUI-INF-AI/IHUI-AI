// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Button, Dialog, DialogContent, DialogTitle, DialogDescription } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import { ExternalLink } from 'lucide-react'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { AuthShell } from '@/components/auth/AuthShell'
import { openExternalUrl } from '@/lib/tauri-bridge'
import { buildSsoLoginUrl, SSO_CLIENT_IDS, WEB_BASE } from '@ihui/shared'
import { useDesktop } from '@/hooks/use-desktop'
import { useIsMobile } from '@/hooks/use-media-query'
import { LoginFormContent } from './LoginFormContent'
import { RegisterFormContent } from './RegisterFormContent'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { LoginWithTurnstile } from './LoginWithTurnstile'

/**
 * 主站统一登录/注册/找回密码弹窗(2026-07-20 重做 / 2026-07-20 修订 / 2026-07-31 优化)
 *
 * 改动:
 * - 复用 AuthShell 共享外壳(顶部 logo + welcome 并排 + 标题 + 副标题)
 * - 与 /sso/login、/sso/register 视觉完全统一
 * - DialogContent 内置 Close(已统一视觉) 负责 onClose,AuthShell 不再渲染关闭按钮
 * - 2026-07-20:恢复 M-66/M-68/M-69 logo+welcome 并排方案,DialogContent max-w 同步 420→460
 * - 2026-07-31:移除 DialogContent 自身 min-[640px]:rounded-xl(AuthShell 内部已 rounded-xl),
 *   避免小屏双层圆角叠加视觉割裂;移除 pointer-events-none [&>div]:pointer-events-auto
 *   旧 Radix 策略(2026 Radix UI 已不需要,新版默认全启用,旧策略会导致子元素事件穿透)
 */
export function LoginDialog() {
  const t = useTranslations('auth')
  const router = useRouter()
  const isOpen = useLoginDialogStore((s) => s.isOpen)
  const mode = useLoginDialogStore((s) => s.mode)
  const close = useLoginDialogStore((s) => s.close)
  const setMode = useLoginDialogStore((s) => s.setMode)

  const { isDesktop } = useDesktop()
  // 2026-09-06 立:App/移动端(<1024px)登录/注册/找回密码改为独立全屏页形态,桌面保留居中弹窗。
  // 判定复用 useIsMobile()(max-width:1023px),与 useDesktop() 的 768px 阈值无重叠冲突。
  const isMobile = useIsMobile()

  const showDesktopSso = isDesktop

  const handleDesktopSso = React.useCallback(async () => {
    // Dev: desktop webview loads from http://localhost:8801 → 外部浏览器可访问同一 dev server
    // Prod: desktop webview loads from tauri://localhost → 用 WEB_BASE (https://aizhs.top)
    const webBase =
      typeof window !== 'undefined' &&
      (window.location.origin.startsWith('http://') ||
        window.location.origin.startsWith('https://'))
        ? window.location.origin
        : WEB_BASE
    const ssoUrl = buildSsoLoginUrl(webBase, 'ihui://sso', SSO_CLIENT_IDS.DESKTOP)
    await openExternalUrl(ssoUrl)
  }, [])

  const handleLoginSuccess = React.useCallback(() => {
    const redirectUrl = useLoginDialogStore.getState().redirectUrl
    close()
    if (redirectUrl && redirectUrl !== window.location.pathname + window.location.search) {
      router.push(redirectUrl)
    }
  }, [close, router])

  const title =
    mode === 'login'
      ? t('loginTitle')
      : mode === 'register'
        ? t('registerTitle')
        : t('forgotPassword')
  const subtitle =
    mode === 'login'
      ? t('loginSubtitle')
      : mode === 'register'
        ? t('registerSubtitle')
        : t('forgotSubtitle')

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent
        data-testid="login-dialog"
        hideCloseButton
        className={
          isMobile
            ? // 移动/App:全屏全出血(背景 surface,无圆角/阴影/边框),登录/注册/找回三态统一
              // 必须显式 left-0 top-0 translate-x-0 translate-y-0 抵消 DialogContent 基类
              // 的 left-[50%] top-[50%] translate-x/y-[-50%] 居中,否则全屏盒被平移出屏只露左上角。
              'fixed left-0 top-0 translate-x-0 translate-y-0 h-dvh w-full max-w-none max-h-none overflow-y-auto gap-0 p-0 border-0 bg-background rounded-none shadow-none'
            : // 桌面:保持原居中卡片
              'gap-0 p-0 max-w-[460px] w-[calc(100%-2rem)] max-h-[95vh] overflow-y-auto border-0 bg-transparent shadow-none'
        }
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{subtitle}</DialogDescription>

        {isMobile ? (
          // 移动/App 全屏形态:垂直居中 + 安全区 padding + 透明全出血 AuthShell
          <div className="flex min-h-full flex-col justify-center px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
            <AuthShell
              onClose={close}
              hideCloseButton
              className="w-full max-w-none rounded-none border-0 bg-transparent p-5 shadow-none"
            >
              {mode === 'login' ? (
                <LoginWithTurnstile>
                  <LoginFormContent tabs={['email', 'phone', 'password']} onSuccess={handleLoginSuccess} />
                </LoginWithTurnstile>
              ) : mode === 'register' ? (
                <RegisterFormContent onSuccess={() => setMode('login')} />
              ) : (
                <ForgotPasswordForm />
              )}
            </AuthShell>
          </div>
        ) : (
          <AuthShell onClose={close}>
            {showDesktopSso && mode === 'login' && (
              <div className="pb-3">
                <Button size="lg" variant="outline" className="w-full px-4" onClick={handleDesktopSso}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  <span>{t('loginInBrowser')}</span>
                </Button>
              </div>
            )}
            {mode === 'login' ? (
              <LoginWithTurnstile>
                <LoginFormContent onSuccess={handleLoginSuccess} />
              </LoginWithTurnstile>
            ) : mode === 'register' ? (
              <RegisterFormContent onSuccess={() => setMode('login')} />
            ) : (
              <ForgotPasswordForm />
            )}
          </AuthShell>
        )}
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
