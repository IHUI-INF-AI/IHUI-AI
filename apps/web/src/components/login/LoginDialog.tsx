'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@ihui/ui-react'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { LoginFormContent } from './LoginFormContent'
import { RegisterFormContent } from './RegisterFormContent'
import { ForgotPasswordForm } from './ForgotPasswordForm'

/**
 * 主站统一登录/注册/找回密码弹窗
 *
 * 视觉结构(2026-07-28 重构,根治协议弹窗位置错位 + LoginDialog 双层容器问题):
 *   - DialogContent 自身是完整视觉容器:max-w-[460px] + rounded-xl + border + bg-card + subtle 阴影
 *   - 内部直接渲染关闭按钮 + logo+welcome 头部 + 表单内容,**不再嵌 AuthShell 中间层**
 *   - 不再用 `border-0 bg-transparent shadow-none pointer-events-none [&>div]:pointer-events-auto` hack
 *     (该 hack 创建了双层容器,叠加嵌套 Dialog 的 Portal 行为,导致协议弹窗位置错乱)
 *   - Radix Dialog 的 onInteractOutside 已自动处理"点击外侧关闭",无需 pointer-events hack
 *
 * SSO 路由(/sso/login /sso/register)继续用 AuthShell,因它们用 AuthShellPage 自定义遮罩
 * 包整个 AuthShell,逻辑独立不受本重构影响。
 *
 * 历史:
 *   - 2026-07-20 重做,沿用 AuthShell 嵌套结构
 *   - 2026-07-20 修订恢复 M-66/M-68/M-69 logo+welcome 并排
 *   - 2026-07-28 重构:DialogContent 自身做容器,移除双层 hack,根治协议弹窗位置错位
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
          gap-0
          p-0
          max-w-[460px]
          w-[calc(100%-2rem)]
          max-h-[95vh]
          overflow-y-auto
          sm:rounded-xl
          border border-border bg-card
          shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)]
        "
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{subtitle}</DialogDescription>

        {/* 关闭按钮(绝对定位右上,2026-07-28 重构从 AuthShell 提取到 DialogContent 内部) */}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>

        {/* logo + welcome 头部(从 AuthShell 提取,2026-07-28 重构) */}
        <div className="login-scope flex flex-col items-center text-center pt-7 px-7">
          <div className="flex items-center justify-center gap-3">
            <img
              src="/images/logo.png"
              alt="IHUI AI"
              width={31}
              height={31}
              className="h-[31px] w-[31px] shrink-0 select-none rounded-md object-contain"
              style={{ transform: 'translateY(2px)' }}
              draggable={false}
            />
            <div className="relative h-[52px] w-[340px] shrink-0">
              <img
                src="/images/welcome.svg"
                alt="Welcome to IHUI AI"
                width={447}
                height={67}
                className="welcome-img absolute inset-0 m-auto h-full w-auto"
                draggable={false}
              />
              <img
                src="/images/baiwelcome.svg"
                alt=""
                aria-hidden="true"
                width={447}
                height={67}
                className="welcome-img-dark absolute inset-0 m-auto h-full w-auto"
                draggable={false}
              />
            </div>
          </div>
        </div>

        {/* 表单内容(从 AuthShell 提取,2026-07-28 重构) */}
        <div className="px-7 pb-7 mt-6">
          {mode === 'login' ? (
            <LoginFormContent onSuccess={handleLoginSuccess} />
          ) : mode === 'register' ? (
            <RegisterFormContent onSuccess={() => setMode('login')} />
          ) : (
            <ForgotPasswordForm />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
