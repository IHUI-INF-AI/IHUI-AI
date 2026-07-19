'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { LoginFormContent } from './LoginFormContent'
import { RegisterFormContent } from './RegisterFormContent'
import { ForgotPasswordForm } from './ForgotPasswordForm'

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

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="
          sm:rounded-xl
          gap-0
          p-0
          max-w-[460px]
          w-[calc(100%-2rem)]
          max-h-[95vh]
          overflow-y-auto
          shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.08)]
        "
      >
        <DialogTitle className="sr-only">
          {mode === 'login'
            ? t('loginTitle')
            : mode === 'register'
              ? t('registerTitle')
              : t('forgotPassword')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {mode === 'login'
            ? t('loginSubtitle')
            : mode === 'register'
              ? t('registerSubtitle')
              : t('forgotSubtitle')}
        </DialogDescription>

        <div className="flex flex-col items-center px-6 pt-6 pb-2 text-center bg-gradient-to-b from-background to-muted/40 rounded-t-xl">
          {/* 顶部 logo:容器无背景色,直接渲染项目 logo.svg(logo.svg 自身已带圆角渐变底+智字)。 */}
          <Image
            src="/images/logo.svg?v=20260719"
            alt="IHUI AI"
            width={40}
            height={40}
            className="h-10 w-10 select-none"
            draggable={false}
            unoptimized
          />
          {/* 顶部已由 logo.svg 渲染图标,此处欢迎图替代原来的"欢迎回来 登录您的账号"文字。 */}
          <Image
            src="/images/welcome.svg"
            alt="Welcome to IHUI AI"
            width={447}
            height={67}
            className="welcome-img mt-3 h-auto w-[240px] max-w-full md:w-[280px]"
            loading="eager"
            unoptimized
          />
          <Image
            src="/images/baiwelcome.svg"
            alt=""
            aria-hidden="true"
            width={447}
            height={67}
            className="welcome-img-dark mt-3 h-auto w-[240px] max-w-full md:w-[280px]"
            loading="eager"
            unoptimized
          />
        </div>

        <div className="px-6 pb-6 pt-4">
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
