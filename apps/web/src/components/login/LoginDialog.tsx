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
        className="
          gap-0
          p-0
          max-w-[460px]
          w-[calc(100%-2rem)]
          max-h-[95vh]
          overflow-y-auto
          border-0 bg-transparent shadow-none
        "
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{subtitle}</DialogDescription>

        <AuthShell onClose={close}>
          {showDesktopSso && mode === 'login' && (
            <div className="pb-3">
              <Button variant="outline" className="h-10 w-full" onClick={handleDesktopSso}>
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
      </DialogContent>
    </Dialog>
  )
}
