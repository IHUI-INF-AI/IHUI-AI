'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginFormContent } from './LoginFormContent'
import { RegisterFormContent } from './RegisterFormContent'
import { ForgotPasswordForm } from './ForgotPasswordForm'

/**
 * 主站统一登录/注册/找回密码弹窗(2026-07-20 重做 / 2026-07-20 修订)
 *
 * 改动:
 * - 复用 AuthShell 共享外壳(顶部 logo + welcome 并排 + 标题 + 副标题)
 * - 与 /sso/login、/sso/register 视觉完全统一
 * - DialogContent 内置 Close(已统一视觉) 负责 onClose,AuthShell 不再渲染关闭按钮
 * - 2026-07-20:恢复 M-66/M-68/M-69 logo+welcome 并排方案,DialogContent max-w 同步 420→460
 */
export function LoginDialog() {
  const t = useTranslations('auth')
  const router = useRouter()
  const isOpen = useLoginDialogStore((s) => s.isOpen)
  const mode = useLoginDialogStore((s) => s.mode)
  const close = useLoginDialogStore((s) => s.close)
  const setMode = useLoginDialogStore((s) => s.setMode)

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
        className="
          sm:rounded-xl
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

        <AuthShell>
          {mode === 'login' ? (
            <LoginFormContent onSuccess={handleLoginSuccess} />
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
