'use client'

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { LoginFormContent } from './LoginFormContent'
import { RegisterFormContent } from './RegisterFormContent'

export function LoginDialog() {
  const t = useTranslations('auth')
  const isOpen = useLoginDialogStore((s) => s.isOpen)
  const mode = useLoginDialogStore((s) => s.mode)
  const close = useLoginDialogStore((s) => s.close)
  const setMode = useLoginDialogStore((s) => s.setMode)

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="
          sm:rounded-xl
          gap-0
          p-6
          max-w-[460px]
          w-[calc(100%-2rem)]
          max-h-[95vh]
          overflow-y-auto
          shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.08)]
        "
      >
        <DialogTitle className="sr-only">
          {mode === 'login' ? t('loginTitle') : t('registerTitle')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {mode === 'login' ? t('loginSubtitle') : t('registerSubtitle')}
        </DialogDescription>
        {mode === 'login' ? (
          <LoginFormContent variant="dialog" onSuccess={close} />
        ) : (
          <RegisterFormContent variant="dialog" onSuccess={() => setMode('login')} />
        )}
      </DialogContent>
    </Dialog>
  )
}
