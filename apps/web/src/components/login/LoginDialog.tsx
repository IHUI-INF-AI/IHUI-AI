'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

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
          <Image
            src="/images/welcome.svg"
            alt="Welcome to IHUI AI"
            width={447}
            height={67}
            className="welcome-img mb-3 h-auto w-[240px] max-w-full md:w-[280px]"
            loading="eager"
            unoptimized
          />
          <Image
            src="/images/baiwelcome.svg"
            alt=""
            aria-hidden="true"
            width={447}
            height={67}
            className="welcome-img-dark mb-3 h-auto w-[240px] max-w-full md:w-[280px]"
            loading="eager"
            unoptimized
          />
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-base font-bold tracking-tight">IHUI AI</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">AI SaaS Platform</p>
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
