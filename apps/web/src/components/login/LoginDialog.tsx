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

        <div className="flex items-center justify-center gap-3 px-6 pt-6 pb-4 bg-gradient-to-b from-background to-muted/40 rounded-t-xl">
          {/* 顶部 logo 与 welcome 图左右并排布局(M-66,2026-07-19):
              - flex row,items-center 让 logo 与 welcome 视觉中心对齐
              - logo 固定 52×52(w-[52px] h-[52px],与原 80×80 同比缩小以腾出 welcome 横向空间)
              - welcome 区 h-[52px] w-full max-w-[348px] 绝对定位叠加 light/dark 两版本
              - 52 + gap-3(12) + 348 = 412,刚好等于 dialog 容器 460 - 2*24 内宽
              - 欢迎图自然宽 52*447/67 ≈ 347px,正好填满 348 容器且不变形 */}
          <Image
            src="/images/logo.png?v=20260719-login"
            alt="IHUI AI"
            width={52}
            height={52}
            className="h-[52px] w-[52px] shrink-0 select-none rounded-xl"
            draggable={false}
            unoptimized
            priority
          />
          <div className="relative h-[52px] w-full max-w-[348px]">
            <Image
              src="/images/welcome.svg"
              alt="Welcome to IHUI AI"
              width={447}
              height={67}
              className="welcome-img absolute inset-0 m-auto h-full w-auto"
              loading="eager"
              unoptimized
            />
            <Image
              src="/images/baiwelcome.svg"
              alt=""
              aria-hidden="true"
              width={447}
              height={67}
              className="welcome-img-dark absolute inset-0 m-auto h-full w-auto"
              loading="eager"
              unoptimized
            />
          </div>
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
